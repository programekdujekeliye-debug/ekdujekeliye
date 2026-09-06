Add-Type -AssemblyName System.IO.Compression.FileSystem

$zips = @(
  'C:\Users\jayne\Downloads\Ek_Duje_Ke_Liye_-_Sardar_Patel_Smruti_Bhavan_PAID_framed_photos.zip',
  'C:\Users\jayne\Downloads\Ek_Duje_Ke_Liye_-_Sardar_Patel_Smruti_Bhavan_PAID_framed_photos (1).zip',
  'C:\Users\jayne\Downloads\Ek_Duje_Ke_Liye_-_Sardar_Patel_Smruti_Bhavan_PAID_framed_photos (2).zip'
)

foreach ($zipPath in $zips) {
  if (Test-Path $zipPath) {
    Write-Host "========================================"
    Write-Host "ZIP:" (Split-Path $zipPath -Leaf)
    $zip = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
    Write-Host "Total entries:" $zip.Entries.Count
    $pngs = @($zip.Entries | Where-Object { $_.Name -like '*.png' })
    $csvs = @($zip.Entries | Where-Object { $_.Name -like '*.csv' })
    Write-Host "PNG count:" $pngs.Count
    Write-Host "CSV count:" $csvs.Count
    if ($zipPath -like "*framed_photos (2).zip") {
      Write-Host "All filenames in (2).zip:"
      foreach ($p in $pngs) {
        Write-Host "  " $p.Name
      }
    }
    $zip.Dispose()
  } else {
    Write-Host "File not found: $zipPath"
  }
}
