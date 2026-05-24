import fs from 'fs/promises'
import path from 'path'

export async function writeJsonAtomic(filePath, data) {
  const dir = path.dirname(filePath)
  await fs.mkdir(dir, { recursive: true })
  const tmp = `${filePath}.tmp`
  const content = JSON.stringify(data, null, 2)
  await fs.writeFile(tmp, content, 'utf8')
  await fs.rename(tmp, filePath)
}
