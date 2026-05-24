import fs from 'fs/promises'
import path from 'path'
import { parse } from 'csv-parse/sync'
import { config, SERVER_ROOT } from '../src/config/env.js'
import { readAll, writeAll } from '../src/repositories/productsRepository.js'
import { csvRowToProductInput, validateProductInput } from '../src/utils/productValidators.js'

function printUsage() {
  console.log(`Uso:
  node scripts/import-products.js --file <ruta.csv> [--dry-run] [--mode upsert]

Ejemplos:
  node scripts/import-products.js --file imports/productos_claudia_piloto.csv --dry-run
  node scripts/import-products.js --file imports/productos_claudia_piloto.csv --mode upsert`)
}

function parseArgs(argv) {
  const args = { file: null, dryRun: false, mode: 'upsert' }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--dry-run') {
      args.dryRun = true
      continue
    }
    if (arg === '--file') {
      args.file = argv[i + 1]
      i += 1
      continue
    }
    if (arg === '--mode') {
      args.mode = argv[i + 1]
      i += 1
      continue
    }
    if (arg === '--help' || arg === '-h') {
      return { help: true }
    }
  }

  return args
}

function resolveFilePath(fileArg) {
  if (!fileArg) return null
  return path.isAbsolute(fileArg) ? fileArg : path.resolve(SERVER_ROOT, fileArg)
}

function formatTimestamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('')
}

function isEmptyRow(row) {
  return Object.values(row).every((value) => String(value ?? '').trim() === '')
}

async function createBackup(productsPath) {
  const backupDir = path.join(SERVER_ROOT, 'data/backups')
  await fs.mkdir(backupDir, { recursive: true })
  const backupPath = path.join(backupDir, `products-${formatTimestamp()}.json`)
  await fs.copyFile(productsPath, backupPath)
  return backupPath
}

function upsertProducts(existing, imported) {
  const byId = new Map(existing.map((product) => [product.id, product]))
  for (const product of imported) {
    byId.set(product.id, product)
  }
  return Array.from(byId.values())
}

function printRowErrors(errors) {
  for (const item of errors) {
    console.log(`  - Fila ${item.rowNumber} (${item.id || 'sin-id'}): ${item.errors.join('; ')}`)
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    printUsage()
    process.exit(0)
  }

  const filePath = resolveFilePath(args.file)
  if (!filePath) {
    console.error('Error: falta --file <ruta.csv>')
    printUsage()
    process.exit(1)
  }

  if (args.mode !== 'upsert') {
    console.error(`Error: mode "${args.mode}" no soportado. Usar --mode upsert`)
    process.exit(1)
  }

  let csvContent
  try {
    csvContent = await fs.readFile(filePath, 'utf8')
  } catch (err) {
    console.error(`Error leyendo CSV (${filePath}):`, err.message)
    process.exit(1)
  }

  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
    relax_column_count: true,
  })

  console.log(`Archivo leído: ${filePath}`)
  console.log(`Filas CSV: ${records.length}`)

  const rowErrors = []
  const validProducts = []
  const seenCsvIds = new Map()

  for (let index = 0; index < records.length; index += 1) {
    const row = records[index]
    const rowNumber = index + 2

    if (isEmptyRow(row)) continue

    const title = String(row.title ?? '').trim()
    if (!title) {
      rowErrors.push({ rowNumber, id: row.id, errors: ['title es obligatorio'] })
      continue
    }

    const input = csvRowToProductInput(row)
    const { product, errors } = validateProductInput(input, { requireId: false })
    if (errors.length) {
      rowErrors.push({ rowNumber, id: input.id || row.id, errors })
      continue
    }

    if (seenCsvIds.has(product.id)) {
      rowErrors.push({
        rowNumber,
        id: product.id,
        errors: [`id duplicado en CSV (primera aparición fila ${seenCsvIds.get(product.id)})`],
      })
      continue
    }

    seenCsvIds.set(product.id, rowNumber)
    validProducts.push({ rowNumber, product })
  }

  let existing = []
  try {
    existing = await readAll()
  } catch (err) {
    console.error('Error leyendo products.json:', err.message)
    process.exit(1)
  }

  const existingIds = new Set(existing.map((product) => product.id).filter(Boolean))
  const toCreate = []
  const toUpdate = []

  for (const item of validProducts) {
    if (existingIds.has(item.product.id)) {
      toUpdate.push(item)
    } else {
      toCreate.push(item)
    }
  }

  console.log(`Productos válidos: ${validProducts.length}`)
  console.log(`Productos con errores: ${rowErrors.length}`)
  console.log(`Productos a crear: ${toCreate.length}`)
  console.log(`Productos a actualizar: ${toUpdate.length}`)

  if (rowErrors.length) {
    console.log('\nErrores por fila:')
    printRowErrors(rowErrors)
    console.log('\nNo se escribió products.json por errores de validación.')
    process.exit(1)
  }

  if (validProducts.length === 0) {
    console.log('\nNo hay productos válidos para importar.')
    process.exit(0)
  }

  const importedProducts = validProducts.map((item) => item.product)
  const merged = upsertProducts(existing, importedProducts)

  if (args.dryRun) {
    console.log('\n[dry-run] No se escribió products.json')
    if (toCreate.length) {
      console.log('[dry-run] Crearían:', toCreate.map((item) => item.product.id).join(', '))
    }
    if (toUpdate.length) {
      console.log('[dry-run] Actualizarían:', toUpdate.map((item) => item.product.id).join(', '))
    }
    process.exit(0)
  }

  const backupPath = await createBackup(config.productsPath)
  await writeAll(merged)

  console.log(`\nBackup creado: ${backupPath}`)
  console.log(`Importación completada en: ${config.productsPath}`)
  console.log(`Total productos en catálogo: ${merged.length}`)
  process.exit(0)
}

main().catch((err) => {
  console.error('Error inesperado en importación:', err)
  process.exit(1)
})
