# Elemental Army Run — Riftway Protocol

> **Topik UTS:** Elemental Army Run  
> **Bentuk:** mini game 3D runner untuk browser

Pimpin pasukan Fire, Water, atau Electric menyeberangi Ashen Causeway. Pilihan gate mengubah jumlah dan elemen pasukan; shock pylon menguji jalur yang dipilih; lalu pasukan menghadapi Shadow Guard dan Rift Warden.

## Anggota dan kontribusi

| Anggota | NRP | Kontribusi |
| --- | --- | --- |
| Mario Napitupulu | 5025241085 | Scene dan environment, gate, crowd formation, model GLTF |
| Nathanael Oliver Amadhika Yuswana | 5025241109 | Gameplay, battle dan state game, elemental VFX, HUD |

Pembagian kontribusi dapat disesuaikan dengan pembagian kerja akhir kelompok.

## Gameplay dan objective

Mulai dengan 12 Firekin. Pasukan berlari otomatis; geser ke kiri atau kanan untuk masuk ke salah satu gate atau menghindari shock pylon. Klik gate yang terlihat untuk mengunci pilihan. Jika gate dilewati tanpa diklik, pasukan mengambil gate yang paling dekat dengan posisinya.

| Urutan | Pilihan gate |
| --- | --- |
| 1 | `+5 Fire Recruits` atau `×2 Clone the Army` |
| 2 | `Convert to Water` atau `+5 Electric Recruits` |
| 3 | `×2 Clone the Army` atau `Convert to Electric` |

Hindari tiga shock pylon. Pasukan yang cukup kuat dapat melewati Shadow Guard dan mengalahkan Rift Warden. **Menang** jika kekuatan pasukan mengalahkan Warden; **kalah** jika pasukan kalah dalam salah satu battle. Gunakan tombol restart untuk mengulang dari awal.

## Kontrol

- Setelah mulai, pasukan berlari otomatis. Klik tombol **LEFT** / **RIGHT** pada HUD agar bisa dimainkan tanpa keyboard; tombol ini juga bisa disentuh di layar ponsel.
- `A` / `D` atau tombol panah kiri/kanan: pindah jalur.
- Klik panel gate yang ingin dipilih untuk mengunci rute.
- Klik **Deploy Your Army** untuk memulai; klik **Run It Back** atau tekan `R` setelah hasil untuk mengulang.

## Fitur grafika dan interaksi

- Scene Three.js dengan perspektif third-person, jalur, environment reruntuhan prosedural, kabut, starfield, dan fog.
- Model prajurit low-poly **GLTF buatan project** dengan struktur parent–child. Material pasukan berubah secara PBR untuk Fire, Water transparan, dan Electric emissive.
- Formation leader dan followers; jumlah pada HUD mengikuti pasukan aktual (hingga 99), dengan maksimum 24 model crowd dirender agar scene tetap ringan.
- Gate emissive dengan portal dan tekstur procedural yang bergerak, serta panel pilihan yang dapat dipilih memakai `THREE.Raycaster`.
- Animasi lari unit, portal/gate pulse, pylon, boss, dan particle system untuk fire sparks, water bubbles, electric arcs, serta shockwave saat gate/battle.
- Minimal dua lampu, shadow map, object yang cast shadow, surface yang receive shadow, HUD progress dan objective, battle health feedback, win/lose state, dan reset.

## Cara menjalankan

Project ini memakai ES modules dan memuat Three.js 0.169.0 dari jsDelivr. Jalankan melalui server HTTP lokal, dengan koneksi internet agar modul Three.js dapat dimuat.

1. Buka folder `Praktikum-UTS` di VS Code, lalu jalankan **Live Server** pada `index.html`; atau dari terminal di folder ini jalankan:

   ```powershell
   python -m http.server 8000
   ```

2. Buka `http://localhost:8000` di browser desktop.
3. Tunggu layar loading hilang, lalu klik **Deploy Your Army**.

Jangan membuka `index.html` langsung lewat `file://`, karena browser akan memblokir pemuatan ES module dan GLTF lokal.

## Deploy ke GitHub Pages

Workflow `.github/workflows/deploy.yml` otomatis mengunggah folder `Praktikum-UTS` setiap kali ada push ke branch `main`. Untuk mengaktifkan Pages pertama kali, buka **Settings → Pages** pada repository dan pilih **GitHub Actions** sebagai *Build and deployment source*. Setelah workflow selesai, situs tersedia di:

**https://kenzy-tc.github.io/Grafkom-Project-ETS/**

## Challenge implementasi

- Menjaga pilihan gate Raycaster dan jalur keyboard tetap selaras dengan auto-run.
- Menyeimbangkan gate jumlah/elemen, hazard collision, kekuatan Shadow Guard, dan syarat boss agar pilihan rute berpengaruh.
- Memvisualisasikan hingga 24 karakter dari satu asset GLTF tanpa flocking, sambil menjaga animasi dan perubahan elemen tetap sinkron.

## Asset credits

- `assets/ember-captain.gltf` dan `assets/ember-captain.bin`: model low-poly karakter orisinal yang dibangun secara prosedural oleh project; generator-nya ada di `assets/build-ember-captain.ps1`. Tidak ada asset gambar/model eksternal.
- Three.js 0.169.0 dan GLTFLoader: [Three.js](https://github.com/mrdoob/three.js), lisensi MIT; dimuat dari jsDelivr CDN.
- Efek partikel, tekstur portal, gate signage, boss, environment, dan UI dibuat oleh project.

## Screenshot

`screenshots/main.png` memperlihatkan scene, formation awal, HUD, dan layar deployment project.
