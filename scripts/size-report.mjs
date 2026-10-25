import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve('dist/assets')

async function filesIn(directory) {
    const entries = await readdir(directory, { withFileTypes: true })
    const files = []
    for (const entry of entries) {
        const file = path.join(directory, entry.name)
        if (entry.isDirectory()) files.push(...(await filesIn(file)))
        else files.push(file)
    }
    return files
}

const files = await filesIn(root)
const rows = await Promise.all(
    files
        .filter((file) => /\.(css|js)$/.test(file))
        .map(async (file) => ({ file: path.relative('dist', file), bytes: (await stat(file)).size })),
)

rows.sort((a, b) => b.bytes - a.bytes)
const total = rows.reduce((sum, row) => sum + row.bytes, 0)

console.log('Production asset sizes')
for (const row of rows) console.log(`${String(row.bytes).padStart(8)} B  ${row.file}`)
console.log(`${String(total).padStart(8)} B  total JS + CSS`)