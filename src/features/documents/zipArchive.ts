interface ZipEntry {
  path: string
  data: Uint8Array
  date: Date
}

const encoder = new TextEncoder()

function concat(chunks: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.length, 0))
  let offset = 0
  for (const chunk of chunks) {
    output.set(chunk, offset)
    offset += chunk.length
  }
  return output
}

function crcTable(): Uint32Array {
  const table = new Uint32Array(256)
  for (let index = 0; index < 256; index += 1) {
    let value = index
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    }
    table[index] = value >>> 0
  }
  return table
}

const crc32Table = crcTable()

function crc32(data: Uint8Array): number {
  let value = 0xffffffff
  for (const byte of data) value = crc32Table[(value ^ byte) & 0xff] ^ (value >>> 8)
  return (value ^ 0xffffffff) >>> 0
}

function dosDateTime(date: Date) {
  const year = Math.max(date.getFullYear(), 1980)
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  }
}

function write16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true)
}

function write32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value >>> 0, true)
}

export function buildStoredZip(entries: ZipEntry[]): Blob {
  const localParts: Uint8Array[] = []
  const centralParts: Uint8Array[] = []
  let offset = 0

  for (const entry of entries) {
    const name = encoder.encode(entry.path)
    const checksum = crc32(entry.data)
    const dateTime = dosDateTime(entry.date)
    const local = new Uint8Array(30 + name.length)
    const localView = new DataView(local.buffer)
    write32(localView, 0, 0x04034b50)
    write16(localView, 4, 20)
    write16(localView, 6, 0x0800)
    write16(localView, 8, 0)
    write16(localView, 10, dateTime.time)
    write16(localView, 12, dateTime.date)
    write32(localView, 14, checksum)
    write32(localView, 18, entry.data.length)
    write32(localView, 22, entry.data.length)
    write16(localView, 26, name.length)
    local.set(name, 30)

    const central = new Uint8Array(46 + name.length)
    const centralView = new DataView(central.buffer)
    write32(centralView, 0, 0x02014b50)
    write16(centralView, 4, 20)
    write16(centralView, 6, 20)
    write16(centralView, 8, 0x0800)
    write16(centralView, 10, 0)
    write16(centralView, 12, dateTime.time)
    write16(centralView, 14, dateTime.date)
    write32(centralView, 16, checksum)
    write32(centralView, 20, entry.data.length)
    write32(centralView, 24, entry.data.length)
    write16(centralView, 28, name.length)
    write32(centralView, 42, offset)
    central.set(name, 46)

    localParts.push(local, entry.data)
    centralParts.push(central)
    offset += local.length + entry.data.length
  }

  const central = concat(centralParts)
  const end = new Uint8Array(22)
  const endView = new DataView(end.buffer)
  write32(endView, 0, 0x06054b50)
  write16(endView, 8, entries.length)
  write16(endView, 10, entries.length)
  write32(endView, 12, central.length)
  write32(endView, 16, offset)
  return new Blob([...localParts, central, end].map((part) => part.slice().buffer as ArrayBuffer), { type: 'application/zip' })
}

export function makeZipTextEntry(path: string, content: string): ZipEntry {
  return { path, data: encoder.encode(content), date: new Date() }
}

export function makeUniqueArchivePath(path: string, usedPaths: Set<string>): string {
  if (!usedPaths.has(path)) {
    usedPaths.add(path)
    return path
  }

  const extensionIndex = path.lastIndexOf('.')
  const stem = extensionIndex > 0 ? path.slice(0, extensionIndex) : path
  const extension = extensionIndex > 0 ? path.slice(extensionIndex) : ''
  let suffix = 2
  let candidate = `${stem} (${suffix})${extension}`

  while (usedPaths.has(candidate)) {
    suffix += 1
    candidate = `${stem} (${suffix})${extension}`
  }

  usedPaths.add(candidate)
  return candidate
}

export function makeZipBlobEntry(path: string, blob: Blob): Promise<ZipEntry> {
  return blob.arrayBuffer().then((buffer) => ({ path, data: new Uint8Array(buffer), date: new Date() }))
}

export function downloadBlob(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
}
