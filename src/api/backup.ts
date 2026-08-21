export function importBackupFile(file: File) {
  const form = new FormData()
  form.append('file', file)
  return fetch('/api/backup/import', {
    method: 'POST',
    body: form,
  }).then(async (res) => {
    const payload = (await res.json()) as
      | { success: true; data: { todoCount: number; imageCount: number } }
      | { success: false; message: string }
    if (!payload.success) throw new Error(payload.message || '导入失败')
    return payload.data
  })
}

export async function downloadExportZip() {
  const res = await fetch('/api/backup/export')
  if (!res.ok) {
    let message = `导出失败（${res.status}）`
    try {
      const payload = (await res.json()) as { message?: string }
      if (payload.message) message = payload.message
    } catch {
      // ignore
    }
    throw new Error(message)
  }

  const blob = await res.blob()
  const header = res.headers.get('Content-Disposition') || ''
  const matched = /filename="?([^"]+)"?/i.exec(header)
  const filename = matched?.[1] || `workbench-backup-${new Date().toISOString().slice(0, 10)}.zip`
  return { blob, filename }
}
