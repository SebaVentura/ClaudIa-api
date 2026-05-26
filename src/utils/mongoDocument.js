export function leanDoc(doc) {
  if (doc == null) return doc
  const obj = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc }
  delete obj._id
  delete obj.__v
  return obj
}

export function leanDocs(docs) {
  return docs.map(leanDoc)
}
