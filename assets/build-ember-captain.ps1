$ErrorActionPreference = 'Stop'
$assetDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path

$faces = @(
  @{ normal = @(0, 0, 1); vertices = @(@(-1, -1, 1), @(1, -1, 1), @(1, 1, 1), @(-1, 1, 1)) },
  @{ normal = @(0, 0, -1); vertices = @(@(1, -1, -1), @(-1, -1, -1), @(-1, 1, -1), @(1, 1, -1)) },
  @{ normal = @(1, 0, 0); vertices = @(@(1, -1, 1), @(1, -1, -1), @(1, 1, -1), @(1, 1, 1)) },
  @{ normal = @(-1, 0, 0); vertices = @(@(-1, -1, -1), @(-1, -1, 1), @(-1, 1, 1), @(-1, 1, -1)) },
  @{ normal = @(0, 1, 0); vertices = @(@(-1, 1, 1), @(1, 1, 1), @(1, 1, -1), @(-1, 1, -1)) },
  @{ normal = @(0, -1, 0); vertices = @(@(-1, -1, -1), @(1, -1, -1), @(1, -1, 1), @(-1, -1, 1)) }
)
$positions = [System.Collections.Generic.List[Single]]::new()
$normals = [System.Collections.Generic.List[Single]]::new()
$indices = [System.Collections.Generic.List[UInt16]]::new()
foreach ($face in $faces) {
  foreach ($vertex in $face.vertices) {
    foreach ($coordinate in $vertex) { $positions.Add([Single]$coordinate) }
    foreach ($component in $face.normal) { $normals.Add([Single]$component) }
  }
  $offset = [UInt16]($indices.Count / 6 * 4)
  foreach ($index in @(0, 1, 2, 0, 2, 3)) { $indices.Add([UInt16]($offset + $index)) }
}

$stream = [System.IO.MemoryStream]::new()
$writer = [System.IO.BinaryWriter]::new($stream)
foreach ($value in $positions) { $writer.Write([Single]$value) }
foreach ($value in $normals) { $writer.Write([Single]$value) }
foreach ($value in $indices) { $writer.Write([UInt16]$value) }
$writer.Flush()
[System.IO.File]::WriteAllBytes((Join-Path $assetDirectory 'ember-captain.bin'), $stream.ToArray())
$writer.Dispose()
$stream.Dispose()

$nodes = @(
  @{ name = 'Ember Captain'; children = @(1, 2, 3, 4, 5, 6, 7, 8) },
  @{ name = 'Core'; mesh = 0; translation = @(0, 0.98, 0); scale = @(0.35, 0.49, 0.23) },
  @{ name = 'Helmet'; mesh = 0; translation = @(0, 1.72, 0.015); scale = @(0.245, 0.255, 0.245) },
  @{ name = 'Arm.L'; mesh = 0; translation = @(-0.43, 1.015, 0); scale = @(0.145, 0.39, 0.16) },
  @{ name = 'Arm.R'; mesh = 0; translation = @(0.43, 1.015, 0); scale = @(0.145, 0.39, 0.16) },
  @{ name = 'Leg.L'; mesh = 0; translation = @(-0.175, 0.345, 0); scale = @(0.16, 0.36, 0.19) },
  @{ name = 'Leg.R'; mesh = 0; translation = @(0.175, 0.345, 0); scale = @(0.16, 0.36, 0.19) },
  @{ name = 'Backplate'; mesh = 0; translation = @(0, 1.02, -0.25); scale = @(0.3, 0.45, 0.07) },
  @{ name = 'Rift Blade'; mesh = 0; translation = @(0.66, 0.88, 0.07); scale = @(0.095, 0.68, 0.11) }
)
$gltf = @{
  asset = @{ version = '2.0'; generator = 'Elemental Army Run — original procedural low-poly model' }
  scene = 0
  scenes = @(@{ name = 'Ember Captain'; nodes = @(0) })
  nodes = $nodes
  meshes = @(@{ name = 'Faceted Armor'; primitives = @(@{ attributes = @{ POSITION = 0; NORMAL = 1 }; indices = 2; material = 0; mode = 4 }) })
  materials = @(@{ name = 'Neutral PBR armor'; pbrMetallicRoughness = @{ baseColorFactor = @(0.85, 0.88, 0.9, 1); metallicFactor = 0.46; roughnessFactor = 0.38 }; emissiveFactor = @(0.06, 0.08, 0.1) })
  accessors = @(
    @{ bufferView = 0; componentType = 5126; count = 24; type = 'VEC3'; min = @(-1, -1, -1); max = @(1, 1, 1) },
    @{ bufferView = 1; componentType = 5126; count = 24; type = 'VEC3' },
    @{ bufferView = 2; componentType = 5123; count = 36; type = 'SCALAR'; min = @(0); max = @(23) }
  )
  bufferViews = @(
    @{ buffer = 0; byteOffset = 0; byteLength = 288; target = 34962 },
    @{ buffer = 0; byteOffset = 288; byteLength = 288; target = 34962 },
    @{ buffer = 0; byteOffset = 576; byteLength = 72; target = 34963 }
  )
  buffers = @(@{ uri = 'ember-captain.bin'; byteLength = 648 })
}
$json = $gltf | ConvertTo-Json -Depth 16
$utf8 = [System.Text.UTF8Encoding]::new($false)
[System.IO.File]::WriteAllText((Join-Path $assetDirectory 'ember-captain.gltf'), $json, $utf8)
