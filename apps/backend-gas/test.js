
        let currentUser = null;
        let currentMode = 'hadir';
        let capturedBase64Photo = "";
        let cacheLogJurnal = [];
        let listSemuaKaryawan = [];
        let sessionPollTimer = null;

        // ==== ESCAPE HTML: cegah tabel rusak / XSS dari data user (Kegiatan, Nama, dll) ====
        function escapeHtml(str) {
            if (str === null || str === undefined) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        }

        // ==== WRAPPER google.script.run -> Promise ====
        function gsRun(funcName, ...args) {
            return new Promise((resolve, reject) => {
                google.script.run
                    .withSuccessHandler(resolve)
                    .withFailureHandler(err => reject(err))
                    [funcName](...args);
            });
        }

        function hilangkanLoadingScreen() {
            const loader = document.getElementById('app-loading');
            if (loader) { loader.style.opacity = '0'; setTimeout(() => loader.remove(), 200); }
        }

        function parseUserAgentDetail() {
            const ua = navigator.userAgent;
            if (/Windows NT/.test(ua)) return "Windows PC / Laptop";
            if (/Android/.test(ua)) return "Android Smartphone";
            if (/Macintosh/.test(ua)) return "Apple Mac";
            return "Perangkat Tidak Dikenal";
        }

        // Pengganti onSnapshot Firestore: polling tiap 20 detik cek sesi ganda
        function aktifkanPollingSesi() {
            if (!currentUser || currentUser.role === 'admin') return;
            if (sessionPollTimer) clearInterval(sessionPollTimer);
            sessionPollTimer = setInterval(async () => {
                try {
                    const valid = await gsRun('checkSessionValid', currentUser.rowIndex, currentUser.sessionId);
                    if (!valid) {
                        clearInterval(sessionPollTimer);
                        alert("⚠️ KELUAR OTOMATIS!\nAkun Anda terdeteksi baru saja masuk di perangkat lain.");
                        handleLogout(true);
                    }
                } catch (e) { console.error(e); }
            }, 20000);
        }

        function toggleAuthForm(target) {
            const boxes = ['box-login', 'box-register', 'box-forgot'];
            boxes.forEach(id => document.getElementById(id).classList.add('hidden'));
            if (target === 'register') {
                document.getElementById('box-register').classList.remove('hidden');
            } else if (target === 'forgot') {
                document.getElementById('box-forgot').classList.remove('hidden');
                document.getElementById('forgot-error').classList.add('hidden');
                document.getElementById('forgot-success').classList.add('hidden');
            } else {
                document.getElementById('box-login').classList.remove('hidden');
            }
        }

        async function handleForgotPin(e) {
            e.preventDefault();
            const btn = document.getElementById('btn-forgot');
            const username = document.getElementById('forgot-username').value.trim();
            const errEl = document.getElementById('forgot-error');
            const sucEl = document.getElementById('forgot-success');
            errEl.classList.add('hidden');
            sucEl.classList.add('hidden');
            if (!username) { errEl.textContent = 'Username wajib diisi!'; errEl.classList.remove('hidden'); return; }
            btn.disabled = true;
            btn.textContent = 'Mengirim...';
            try {
                const result = await new Promise((resolve, reject) =>
                    google.script.run.withSuccessHandler(resolve).withFailureHandler(reject).doResetPin(username)
                );
                if (result && result.success) {
                    sucEl.innerHTML = `✅ PIN baru berhasil dikirim ke email: <strong>${result.maskedEmail}</strong>. Silakan cek inbox atau folder spam Anda.`;
                    sucEl.classList.remove('hidden');
                    document.getElementById('forgot-form').reset();
                } else {
                    errEl.textContent = 'Gagal: ' + (result && result.message ? result.message : 'Terjadi kesalahan.');
                    errEl.classList.remove('hidden');
                }
            } catch (err) {
                errEl.textContent = 'Error: ' + (err.message || String(err));
                errEl.classList.remove('hidden');
            } finally {
                btn.disabled = false;
                btn.textContent = 'Kirim PIN Baru ke Email';
            }
        }

        async function handleRegister(e) {
            e.preventDefault();
            const btn = document.getElementById('btn-register');
            const payload = {
                nama: document.getElementById('reg-nama').value.trim(),
                email: document.getElementById('reg-email').value.trim(),
                telepon: document.getElementById('reg-phone').value.trim(),
                devisi: document.getElementById('reg-devisi').value.trim(),
                jabatan: document.getElementById('reg-jabatan').value.trim(),
                username: document.getElementById('reg-username').value.trim().toLowerCase(),
                password: document.getElementById('reg-password').value
            };
            if (!payload.nama || !payload.email || !payload.username || !payload.password) {
                alert('Mohon lengkapi semua field wajib.');
                return;
            }
            btn.disabled = true; btn.innerText = "Memproses...";
            try {
                await gsRun('doRegister', payload);
                alert('Pendaftaran akun personil sukses!');
                document.getElementById('register-form').reset();
                toggleAuthForm('login');
            } catch (err) {
                alert(err.message || String(err));
            } finally {
                btn.disabled = false; btn.innerText = "Daftar Sekarang";
            }
        }

        async function handleLogin(e) {
            e.preventDefault();
            const btn = document.getElementById('btn-login');
            const inputLogin = document.getElementById('username-email').value.trim();
            const passInput = document.getElementById('password').value;
            btn.disabled = true; btn.innerText = "Memverifikasi...";
            try {
                const user = await gsRun('doLogin', inputLogin, passInput);
                currentUser = user;
                localStorage.setItem('user_session', JSON.stringify(currentUser));
                aktifkanPollingSesi();
                await prosesLoginSukses();
            } catch (err) {
                alert('❌ ' + (err.message || String(err)));
            } finally {
                btn.disabled = false; btn.innerText = "Masuk ke Sistem";
            }
        }

        async function prosesLoginSukses() {
            document.getElementById('user-display-name').innerText = currentUser.nama;
            document.getElementById('user-role').innerText = currentUser.role === 'admin' ? "Super Administrator" : `${currentUser.devisi} - ${currentUser.jabatan}`;
            document.getElementById('user-avatar').innerText = (currentUser.nama || '?').charAt(0).toUpperCase();

            document.getElementById('page-auth').classList.add('hidden');
            document.getElementById('main-layout').classList.remove('hidden');

            if (currentUser.role === 'admin') {
                document.getElementById('nav-dashboard').classList.add('hidden');
                document.getElementById('nav-riwayat').classList.add('hidden');
                document.getElementById('nav-admin').classList.remove('hidden');
                document.getElementById('nav-rekap-absensi').classList.remove('hidden');
                document.getElementById('nav-data-karyawan').classList.remove('hidden');
                await switchPage('admin');
            } else {
                document.getElementById('nav-dashboard').classList.remove('hidden');
                document.getElementById('nav-riwayat').classList.remove('hidden');
                document.getElementById('nav-admin').classList.add('hidden');
                document.getElementById('nav-rekap-absensi').classList.add('hidden');
                document.getElementById('nav-data-karyawan').classList.add('hidden');
                await switchPage('dashboard');
            }
            hilangkanLoadingScreen();
        }

        async function handleLogout(skipServerCall) {
            if (sessionPollTimer) clearInterval(sessionPollTimer);
            try {
                if (!skipServerCall && currentUser && currentUser.role !== 'admin' && currentUser.rowIndex > 0) {
                    await gsRun('doLogoutUser', currentUser.rowIndex);
                }
            } catch (e) { console.error(e); }

            currentUser = null;
            localStorage.clear();

            document.getElementById('main-layout').classList.add('hidden');
            document.getElementById('page-auth').classList.remove('hidden');
            document.getElementById('box-login').classList.remove('hidden');
        }

        function setAttendanceMode(mode) {
            currentMode = mode;
            const btnHadir = document.getElementById('mode-hadir');
            const btnIzin = document.getElementById('mode-izin');
            const wrapHadir = document.getElementById('wrapper-input-hadir');
            const wrapIzin = document.getElementById('wrapper-input-izin');
            const wrapAlasan = document.getElementById('wrapper-alasan-izin');
            const labelDokumen = document.getElementById('label-dokumentasi-kamera');
            const kategori = document.getElementById('absen-kategori-izin').value;

            if (mode === 'hadir') {
                btnHadir.className = "flex-1 py-3 rounded-xl font-bold text-xs uppercase tracking-wider bg-[#1b4d3e] text-white transition duration-200 shadow-md";
                btnIzin.className = "flex-1 py-3 rounded-xl font-bold text-xs uppercase tracking-wider bg-gray-100 text-gray-600 transition duration-200";
                wrapHadir.classList.remove('hidden');
                wrapIzin.classList.add('hidden');
                if (labelDokumen) labelDokumen.innerText = "Lampiran Dokumentasi / Kamera";
            } else {
                btnIzin.className = "flex-1 py-3 rounded-xl font-bold text-xs uppercase tracking-wider bg-amber-500 text-white transition duration-200 shadow-md";
                btnHadir.className = "flex-1 py-3 rounded-xl font-bold text-xs uppercase tracking-wider bg-gray-100 text-gray-600 transition duration-200";
                wrapIzin.classList.remove('hidden');
                if (kategori === 'WFH') {
                    wrapHadir.classList.remove('hidden');
                    if (wrapAlasan) wrapAlasan.classList.add('hidden');
                } else {
                    wrapHadir.classList.add('hidden');
                    if (wrapAlasan) wrapAlasan.classList.remove('hidden');
                }
                if (labelDokumen) labelDokumen.innerText = "Upload Surat Keterangan Sakit Jika Ada";
            }
            resetPhoto();
        }

        function handleKategoriIzinChange() {
            setAttendanceMode(currentMode);
        }

        // Buka aplikasi kamera native (bukan live-preview browser) lewat <input type="file" capture>
        function handleFotoInputChange(event) {
            const file = event.target.files && event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function (e) {
                // kompres dulu lewat canvas biar ukuran base64 gak kegedean buat dikirim ke Apps Script
                const img = new Image();
                img.onload = function () {
                    const maxW = 1024;
                    const scale = Math.min(1, maxW / img.width);
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width * scale;
                    canvas.height = img.height * scale;
                    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                    capturedBase64Photo = canvas.toDataURL('image/jpeg', 0.7);
                    const preview = document.getElementById('photo-preview');
                    preview.src = capturedBase64Photo;
                    preview.classList.remove('hidden');
                    document.getElementById('photo-placeholder').classList.add('hidden');
                    document.getElementById('btn-reset-photo').classList.remove('hidden');
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }

        function resetPhoto() {
            capturedBase64Photo = "";
            document.getElementById('foto-input').value = "";
            if (document.getElementById('photo-preview')) document.getElementById('photo-preview').classList.add('hidden');
            if (document.getElementById('photo-placeholder')) document.getElementById('photo-placeholder').classList.remove('hidden');
            if (document.getElementById('btn-reset-photo')) document.getElementById('btn-reset-photo').classList.add('hidden');
        }

        function getGPSLocation() {
            if (navigator.geolocation) {
                document.getElementById('absen-gps').value = "Mencari satelit koordinat...";
                navigator.geolocation.getCurrentPosition((position) => {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;
                    document.getElementById('absen-gps').value = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
                }, (err) => {
                    document.getElementById('absen-gps').value = "7°36'13.2\"S 112°35'2.1\"E (Default)";
                });
            } else {
                document.getElementById('absen-gps').value = "7°36'13.2\"S 112°35'2.1\"E (Default)";
            }
        }

        async function handleSubmitKegiatan(e) {
            e.preventDefault();

            // Validasi wajib sesuai mode, biar data yang masuk selalu lengkap & konsisten
            if (currentMode === 'hadir') {
                const jamMulai = document.getElementById('absen-jam-mulai').value;
                const jamSelesai = document.getElementById('absen-jam-selesai').value;
                const kegiatan = document.getElementById('absen-kegiatan').value.trim();
                if (!jamMulai || !jamSelesai) { alert('Jam mulai dan jam selesai kerja wajib diisi.'); return; }
                if (!kegiatan) { alert('Rincian kegiatan tugas wajib diisi.'); return; }
                if (!capturedBase64Photo) { alert('Lookbook kehadiran di wajibkan untuk foto!'); return; }
            } else {
                const kategori = document.getElementById('absen-kategori-izin').value;
                if (!kategori) { alert('Kategori Keterangan wajib dipilih.'); return; }
                if (kategori === 'WFH') {
                    const jamMulai = document.getElementById('absen-jam-mulai').value;
                    const jamSelesai = document.getElementById('absen-jam-selesai').value;
                    const kegiatan = document.getElementById('absen-kegiatan').value.trim();
                    if (!jamMulai || !jamSelesai) { alert('Jam mulai dan jam selesai kerja wajib diisi.'); return; }
                    if (!kegiatan) { alert('Rincian kegiatan tugas wajib diisi.'); return; }
                    if (!capturedBase64Photo) { alert('Lookbook kehadiran di wajibkan untuk foto!'); return; }
                }
            }
            if (!document.getElementById('absen-gps').value) {
                alert('Kunci lokasi GPS terlebih dahulu.');
                return;
            }

            const btn = document.getElementById('btn-submit-jurnal');
            const isWfh = currentMode === 'izin' && document.getElementById('absen-kategori-izin').value === 'WFH';
            const isActiveHadir = currentMode === 'hadir' || isWfh;

            const payload = {
                nama: currentUser.nama,
                email: currentUser.email,
                telepon: currentUser.telepon || "-",
                jabatan: currentUser.jabatan,
                devisi: currentUser.devisi,
                status: currentMode.toUpperCase(),
                jamMulai: isActiveHadir ? document.getElementById('absen-jam-mulai').value : "-",
                jamAkhir: isActiveHadir ? document.getElementById('absen-jam-selesai').value : "-",
                kegiatan: isActiveHadir ? document.getElementById('absen-kegiatan').value : "-",
                hasil_kegiatan: isActiveHadir ? document.getElementById('absen-hasil').value : "-",
                izin_sakit: currentMode === 'izin' ? (document.getElementById('absen-kategori-izin').value + (document.getElementById('absen-izin').value.trim() && !isWfh ? " - " + document.getElementById('absen-izin').value.trim() : "")) : "-",
                gps: document.getElementById('absen-gps').value || "7°36'13.2\"S 112°35'2.1\"E",
                foto: capturedBase64Photo || "",
                device: parseUserAgentDetail()
            };
            btn.disabled = true; btn.innerText = "Mengirim...";
            try {
                await gsRun('submitAttendance', payload);
                alert("Berhasil! Jurnal absensi Anda sukses terkirim.");
                document.getElementById('attendance-form').reset();
                const inputs = document.querySelectorAll('input[id^="absen-"], textarea[id^="absen-"], select[id^="absen-"]');
                inputs.forEach(input => localStorage.removeItem('draft_' + input.id));
                resetPhoto();
                switchPage('riwayat');
            } catch (err) {
                alert("Gagal Simpan: " + (err.message || String(err)));
            } finally {
                btn.disabled = false; btn.innerText = "Kirim Log Jurnal Ke Cloud";
            }
        }

        async function renderTabelUserRiwayat() {
            const body = document.getElementById('table-user-riwayat');
            if (!body) return;
            body.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-gray-400">Memuat data...</td></tr>`;
            try {
                const rows = await gsRun('getRiwayatUser', currentUser.email);
                console.log('getRiwayatUser untuk email:', currentUser.email, '-> jumlah baris:', rows ? rows.length : 0, rows);
                if (!rows || rows.length === 0) {
                    body.innerHTML = `<tr><td colspan="6" class="p-4 text-center">Belum ada record absensi untuk email <b>${escapeHtml(currentUser.email)}</b>.<br><span class="text-[10px] text-gray-400">Kalau kamu yakin sudah isi jurnal, cek kolom Email di sheet Absensi persis sama dengan email ini.</span><br><br><div class="mt-4 p-3 bg-red-50 text-red-700 text-xs text-left rounded border border-red-200"><b>DEBUG INFO (Bantu saya pecahkan masalah):</b><br>1. Data Diterima: ${escapeHtml(JSON.stringify(rows))}<br>2. Apakah ini script terbaru? <b>IYA (v2.0)</b><br>Jika Anda TIDAK melihat tulisan "(v2.0)" ini, berarti Anda <b>belum melakukan "New Deployment"</b> di Google Apps Script. Server masih menjalankan kode lama!</div></td></tr>`;
                    return;
                }
                body.innerHTML = '';
                rows.forEach(j => {
                    const tampilJamMulai = String(j.JamMulai).includes(' ') ? String(j.JamMulai).split(' ').pop() : (j.JamMulai || "-");
                    const tampilJamAkhir = String(j.JamAkhir).includes(' ') ? String(j.JamAkhir).split(' ').pop() : (j.JamAkhir || "-");
                    const kegiatanCell = j.Status === 'HADIR'
                        ? escapeHtml(j.Kegiatan)
                        : `<span class="text-amber-600 font-bold">[IZIN]</span> ${escapeHtml(j.IzinSakit)}`;
                    body.innerHTML += `<tr>
                        <td class="p-4">${escapeHtml(j.Tanggal)} ${escapeHtml(j.Bulan)} ${escapeHtml(j.Tahun)}</td>
                        <td class="p-4 font-bold">${escapeHtml(tampilJamMulai)} - ${escapeHtml(tampilJamAkhir)}</td>
                        <td class="p-4">${kegiatanCell}</td>
                        <td class="p-4">${escapeHtml(j.HasilKegiatan) || '-'}</td>
                        <td class="p-4 font-mono text-[10px]">${escapeHtml(j.GPS)}</td>
                        <td class="p-4 text-center">${j.FotoURL ? `<a href="${encodeURI(j.FotoURL)}" target="_blank"><img src="${encodeURI(j.FotoURL)}" class="w-8 h-8 rounded mx-auto object-cover"></a>` : '-'}</td>
                    </tr>`;
                });
            } catch (e) {
                console.error(e);
                body.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-rose-600">Gagal memuat riwayat: ${escapeHtml(e.message || e)}</td></tr>`;
            }
        }

        async function fetchLogJurnalDariCloud() {
            try {
                const result = await gsRun('getAllAbsensi');
                cacheLogJurnal = Array.isArray(result) ? result : [];
            } catch (err) {
                console.error('getAllAbsensi gagal:', err);
                alert('Gagal ambil data Absensi dari server: ' + (err.message || err));
                cacheLogJurnal = [];
            }
        }

        async function fetchDaftarKaryawan() {
            try {
                const result = await gsRun('getAllKaryawan');
                listSemuaKaryawan = Array.isArray(result) ? result : [];
            } catch (err) {
                console.error('getAllKaryawan gagal:', err);
                alert('Gagal ambil data Karyawan dari server: ' + (err.message || err));
                listSemuaKaryawan = [];
            }
        }

        async function fetchPilihanIzin() {
            try {
                const result = await gsRun('getPilihanIzin');
                const dropdown = document.getElementById('absen-kategori-izin');
                if (dropdown && result && result.length > 0) {
                    dropdown.innerHTML = '<option value="">-- Pilih Kategori --</option>';
                    result.forEach(opt => {
                        dropdown.innerHTML += `<option value="${escapeHtml(opt)}">${escapeHtml(opt)}</option>`;
                    });
                }
            } catch (err) {
                console.error('Gagal ambil pilihan izin:', err);
            }
        }

        // Hitung durasi jam kerja. Mendukung shift yang lewat tengah malam
        // (mis. 22:00 - 06:00) supaya hasilnya tidak 0.
        function hitungDurasiJam(jamMulai, jamSelesai) {
            if (!jamMulai || !jamSelesai || jamMulai === '-' || jamSelesai === '-') return 0;
            const [h1, m1] = jamMulai.split(':').map(Number);
            const [h2, m2] = jamSelesai.split(':').map(Number);
            if ([h1, m1, h2, m2].some(n => Number.isNaN(n))) return 0;
            let totalMenit = (h2 * 60 + m2) - (h1 * 60 + m1);
            if (totalMenit < 0) totalMenit += 24 * 60; // shift lewat tengah malam
            return totalMenit > 0 ? (totalMenit / 60).toFixed(1) : 0;
        }

        async function switchPage(pageId) {
            const pages = ['page-dashboard', 'page-riwayat', 'page-admin', 'page-rekap-absensi', 'page-data-karyawan'];
            pages.forEach(id => { if (document.getElementById(id)) document.getElementById(id).classList.add('hidden'); });

            if (document.getElementById(`page-${pageId}`)) document.getElementById(`page-${pageId}`).classList.remove('hidden');

            if (pageId === 'dashboard') { 
                getGPSLocation(); fetchPilihanIzin(); 
                const inputs = document.querySelectorAll('input[id^="absen-"], textarea[id^="absen-"], select[id^="absen-"]');
                inputs.forEach(input => {
                    const draft = localStorage.getItem('draft_' + input.id);
                    if(draft) input.value = draft;
                });
            }
            if (pageId === 'riwayat') { await renderTabelUserRiwayat(); }
            if (pageId === 'admin') {
                await fetchLogJurnalDariCloud();
                renderTabelAdminMaster();
                buildAdminKaryawanDropdown();
            }
            if (pageId === 'rekap-absensi') {
                await fetchLogJurnalDariCloud();
                buildRekapKaryawanDropdown();
                renderTabelRekapExcelView();
            }
            if (pageId === 'data-karyawan') {
                await fetchDaftarKaryawan();
                renderTabelDataKaryawan();
            }
        }

        function renderTabelAdminMaster() {
            const body = document.getElementById('table-admin-jurnal');
            if (!body) return;
            body.innerHTML = '';
            if (cacheLogJurnal.length === 0) {
                body.innerHTML = `<tr><td colspan="14" class="p-4 text-center text-gray-400">Database jurnal kosong.</td></tr>`;
                return;
            }
            cacheLogJurnal.forEach(j => {
                body.innerHTML += `<tr class="border-b hover:bg-gray-50/60 transition">
                    <td class="p-3 font-bold text-gray-900">${escapeHtml(j.Nama)}</td>
                    <td class="p-3 text-gray-500">${escapeHtml(j.Email)}</td>
                    <td class="p-3 text-gray-500">${escapeHtml(j.Telepon) || "-"}</td>
                    <td class="p-3 font-medium text-gray-800">${escapeHtml(j.Jabatan)}</td>
                    <td class="p-3"><span class="bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded font-bold">${escapeHtml(j.Divisi)}</span></td>
                    <td class="p-3 max-w-xs break-words">${escapeHtml(j.Kegiatan) || "-"}</td>
                    <td class="p-3 max-w-xs break-words">${escapeHtml(j.HasilKegiatan) || "-"}</td>
                    <td class="p-3 max-w-xs break-words text-amber-800 font-medium">${escapeHtml(j.IzinSakit) || "-"}</td>
                    <td class="p-3 font-mono text-xs text-blue-900 font-semibold bg-blue-50/40">${escapeHtml(j.Device) || "Unknown Perangkat"}</td>
                    <td class="p-3 text-center">${j.FotoURL ? `<a href="${encodeURI(j.FotoURL)}" target="_blank"><img src="${encodeURI(j.FotoURL)}" class="w-12 h-12 object-cover rounded-lg border border-gray-300 mx-auto shadow-sm"></a>` : '-'}</td>
                    <td class="p-3 font-mono text-gray-600 text-[10px]">${escapeHtml(j.GPS)}</td>
                    <td class="p-3 text-center font-bold text-gray-700">${escapeHtml(String(j.JamMulai).includes(' ') ? String(j.JamMulai).split(' ').pop() : (j.JamMulai || "-"))}</td>
                    <td class="p-3 text-center font-bold text-gray-700">${escapeHtml(String(j.JamAkhir).includes(' ') ? String(j.JamAkhir).split(' ').pop() : (j.JamAkhir || "-"))}</td>
                    <td class="p-3 text-gray-500 whitespace-nowrap">${escapeHtml(j.Tanggal)} ${escapeHtml(j.Bulan)} ${escapeHtml(j.Tahun)}</td>
                </tr>`;
            });
        }

        function buildRekapKaryawanDropdown() {
            const dropdown = document.getElementById('rekap-filter-nama');
            if (!dropdown) return;
            dropdown.innerHTML = '<option value="SEMUA">-- Semua Karyawan --</option>';
            const listNamaUnik = [...new Set(cacheLogJurnal.map(j => j.Nama))];
            listNamaUnik.forEach(nama => { dropdown.innerHTML += `<option value="${escapeHtml(nama)}">${escapeHtml(nama)}</option>`; });
        }

        function renderTabelRekapExcelView() {
            const tableBody = document.getElementById('table-rekap-excel-view');
            if (!tableBody) return;
            const filterNama = document.getElementById('rekap-filter-nama').value;
            tableBody.innerHTML = '';

            if (cacheLogJurnal.length === 0) {
                tableBody.innerHTML = `<tr><td colspan="16" class="p-3.5 text-center text-gray-400">Belum ada data absensi untuk direkap.</td></tr>`;
                document.getElementById('total-jam-kerja-foot').innerText = "0.0 Jam";
                document.getElementById('total-hari-kerja-foot').innerText = "0 Hari";
                return;
            }

            const filterDate = document.getElementById('rekap-filter-date').value; // format: YYYY-MM-DD
            const filterMonth = document.getElementById('rekap-filter-month').value; // format: YYYY-MM

            let dataTerfilter = filterNama === 'SEMUA' ? cacheLogJurnal : cacheLogJurnal.filter(j => j.Nama === filterNama);

            if (filterDate) {
                // filterDate is YYYY-MM-DD. We need to match j.Tanggal, j.Bulan, j.Tahun
                // However, j.Timestamp has format "DD-MM-YYYY HH:mm:ss"
                const [yyyy, mm, dd] = filterDate.split('-');
                const targetPrefix = `${dd}-${mm}-${yyyy}`;
                dataTerfilter = dataTerfilter.filter(j => String(j.Timestamp).startsWith(targetPrefix));
            } else if (filterMonth) {
                // filterMonth is YYYY-MM
                const [yyyy, mm] = filterMonth.split('-');
                const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
                const targetMonth = months[parseInt(mm) - 1];
                dataTerfilter = dataTerfilter.filter(j => String(j.Bulan) === targetMonth && String(j.Tahun) === yyyy);
            }


            if (dataTerfilter.length === 0) {
                tableBody.innerHTML = `<tr><td colspan="16" class="p-3.5 text-center text-gray-400">Tidak ada data untuk karyawan ini.</td></tr>`;
                document.getElementById('total-jam-kerja-foot').innerText = "0.0 Jam";
                document.getElementById('total-hari-kerja-foot').innerText = "0 Hari";
                return;
            }

            const setBarisTerproses = new Set();
            const petaKehadiranKaryawan = {}; 
            let akumulasiTotalJam = 0;
            let akumulasiTotalKehadiran = 0;

            dataTerfilter.forEach(j => {
                if (!petaKehadiranKaryawan[j.Nama]) petaKehadiranKaryawan[j.Nama] = 0;
                
                const stringTanggal = `${j.Tanggal}-${j.Bulan}-${j.Tahun}`;
                const kunciDuplikat = `${j.Nama}_${stringTanggal}_${j.JamMulai}_${j.JamAkhir}_${j.Status}`;
                const isWfh = String(j.IzinSakit).startsWith("WFH");
                
                if (j.Status === "HADIR" || isWfh) {
                    if (!setBarisTerproses.has(kunciDuplikat)) {
                        setBarisTerproses.add(kunciDuplikat);
                        const tampilJamMulai = String(j.JamMulai).includes(' ') ? String(j.JamMulai).split(' ').pop() : (j.JamMulai || "-");
                        const tampilJamAkhir = String(j.JamAkhir).includes(' ') ? String(j.JamAkhir).split(' ').pop() : (j.JamAkhir || "-");
                        const jamKerjaBaris = parseFloat(hitungDurasiJam(tampilJamMulai, tampilJamAkhir)) || 0;
                        akumulasiTotalJam += jamKerjaBaris;
                        akumulasiTotalKehadiran += 1;
                        petaKehadiranKaryawan[j.Nama] += 1;
                    }
                }
            });

            dataTerfilter.forEach(j => {
                let jamKerja = '0';
                const tampilJamMulai = String(j.JamMulai).includes(' ') ? String(j.JamMulai).split(' ').pop() : (j.JamMulai || "-");
                const tampilJamAkhir = String(j.JamAkhir).includes(' ') ? String(j.JamAkhir).split(' ').pop() : (j.JamAkhir || "-");
                const isWfh = String(j.IzinSakit).startsWith("WFH");

                if (j.Status === 'HADIR' || isWfh) {
                     jamKerja = hitungDurasiJam(tampilJamMulai, tampilJamAkhir);
                }
                const hadirKaryawanIni = (j.Status === 'HADIR' || isWfh) ? '1 Hari' : '0 Hari';

                tableBody.innerHTML += `<tr class="border-b hover:bg-gray-50 transition">
                    <td class="p-3 font-bold text-gray-900">${escapeHtml(j.Nama)}</td>
                    <td class="p-3 text-gray-500">${escapeHtml(j.Email)}</td>
                    <td class="p-3 text-gray-500">${escapeHtml(j.Telepon) || "-"}</td>
                    <td class="p-3 font-medium text-gray-800">${escapeHtml(j.Jabatan)}</td>
                    <td class="p-3"><span class="bg-gray-100 text-gray-800 px-2 py-0.5 rounded font-bold">${escapeHtml(j.Divisi)}</span></td>
                    <td class="p-3 max-w-xs break-words text-gray-600">${escapeHtml(j.Kegiatan) || "-"}</td>
                    <td class="p-3 max-w-xs break-words text-gray-600">${escapeHtml(j.HasilKegiatan) || "-"}</td>
                    <td class="p-3 max-w-xs break-words text-amber-700 font-medium">${escapeHtml(j.IzinSakit) || "-"}</td>
                    <td class="p-3 font-mono text-gray-500">${escapeHtml(j.Device) || "Unknown"}</td>
                    <td class="p-3 text-center">${j.FotoURL ? `<span class="text-emerald-600 font-semibold text-[10px] bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">Ada Lampiran</span>` : '<span class="text-gray-400">-</span>'}</td>
                    <td class="p-3 font-mono text-gray-500">${escapeHtml(j.GPS)}</td>
                    <td class="p-3 text-center font-semibold text-gray-700">${escapeHtml(tampilJamMulai)}</td>
                    <td class="p-3 text-center font-semibold text-gray-700">${escapeHtml(tampilJamAkhir)}</td>
                    <td class="p-3 text-gray-500 whitespace-nowrap">${escapeHtml(j.Tanggal)} ${escapeHtml(j.Bulan)} ${escapeHtml(j.Tahun)}</td>
                    <td class="p-3 text-center font-bold text-teal-700 bg-teal-50/50">${jamKerja} Jam</td>
                    <td class="p-3 text-center font-bold text-teal-900 bg-teal-100/30">${hadirKaryawanIni}</td>
                </tr>`;
            });

            document.getElementById('total-jam-kerja-foot').innerText = `${akumulasiTotalJam.toFixed(1)} Jam`;
            document.getElementById('total-hari-kerja-foot').innerText = `${akumulasiTotalKehadiran} Hari`;
        }

        function buildAdminKaryawanDropdown() {
            const dropdown = document.getElementById('admin-select-karyawan');
            if (!dropdown) return;
            dropdown.innerHTML = '<option value="SEMUA">-- Cetak Semua Personel --</option>';
            const listNamaUnik = [...new Set(cacheLogJurnal.map(j => j.Nama))];
            listNamaUnik.forEach(nama => { dropdown.innerHTML += `<option value="${escapeHtml(nama)}">${escapeHtml(nama)}</option>`; });
        }

        function renderTabelDataKaryawan() {
            const body = document.getElementById('table-admin-karyawan');
            if (!body) return;
            body.innerHTML = '';
            if (listSemuaKaryawan.length === 0) {
                body.innerHTML = `<tr><td colspan="5" class="p-3.5 text-center text-gray-400">Tidak ada personel terdaftar.</td></tr>`;
                return;
            }
            listSemuaKaryawan.forEach(p => {
                body.innerHTML += `<tr class="border-b hover:bg-gray-50 transition">
                    <td class="p-3.5 font-semibold text-gray-800">${escapeHtml(p.Nama)}</td>
                    <td class="p-3.5 text-emerald-800 font-mono font-bold">${escapeHtml(p.Telepon) || '-'}</td>
                    <td class="p-3.5 text-gray-600">${escapeHtml(p.Email)}</td>
                    <td class="p-3"><span class="bg-emerald-50 text-emerald-900 border border-emerald-100 px-2 py-0.5 rounded-md font-medium">${escapeHtml(p.Divisi)}</span></td>
                    <td class="p-3 text-gray-600">${escapeHtml(p.Jabatan)}</td>
                </tr>`;
            });
        }

        function downloadAbsensiExcel() {
            if (cacheLogJurnal.length === 0) { alert("Tidak ada data untuk diekspor."); return; }
            const filterNama = document.getElementById('rekap-filter-nama').value;
            const dataTerfilter = filterNama === 'SEMUA' ? cacheLogJurnal : cacheLogJurnal.filter(j => j.Nama === filterNama);

            const headers = [
                "Nama Lengkap", "Email", "No. Telepon", "Jabatan", "Divisi",
                "Rincian Kegiatan Tugas", "Hasil Kegiatan", "Izin Sakit / Keterangan",
                "Log Perangkat Absen", "Foto Kegiatan", "Titik Koordinat", "Jam Mulai", "Jam Selesai", "Tanggal Log",
                "Jumlah Jam Kerja", "Jumlah Hari Kerja"
            ];

            const petaKehadiranKaryawan = {};
            dataTerfilter.forEach(j => {
                const isWfh = String(j.IzinSakit).startsWith("WFH");
                if (j.Status === "HADIR" || isWfh) {
                     if (!petaKehadiranKaryawan[j.Nama]) petaKehadiranKaryawan[j.Nama] = 0;
                     petaKehadiranKaryawan[j.Nama] += 1;
                }
            });

            const setBarisTerprosesExcel = new Set();

            const rowsData = dataTerfilter.map(j => {
                const stringTanggal = `${j.Tanggal}-${j.Bulan}-${j.Tahun}`;
                const kunciDuplikat = `${j.Nama}_${stringTanggal}_${j.JamMulai}_${j.JamAkhir}_${j.Status}`;

                let jamKerja = '0 Jam';
                const tampilJamMulai = String(j.JamMulai).includes(' ') ? String(j.JamMulai).split(' ').pop() : (j.JamMulai || "-");
                const tampilJamAkhir = String(j.JamAkhir).includes(' ') ? String(j.JamAkhir).split(' ').pop() : (j.JamAkhir || "-");

                const isWfh = String(j.IzinSakit).startsWith("WFH");
                if (j.Status === "HADIR" || isWfh) {
                    if (!setBarisTerprosesExcel.has(kunciDuplikat)) {
                        setBarisTerprosesExcel.add(kunciDuplikat);
                        jamKerja = `${hitungDurasiJam(tampilJamMulai, tampilJamAkhir)} Jam`;
                    } else {
                        jamKerja = '0 Jam (Duplikat terabaikan)';
                    }
                }

                const hariKerja = (j.Status === "HADIR" || isWfh) ? '1 Hari' : '0 Hari';
                return [
                    j.Nama, j.Email, j.Telepon || "-", j.Jabatan, j.Divisi,
                    j.Kegiatan || "-", j.HasilKegiatan || "-", j.IzinSakit || "-",
                    j.Device || "Unknown Perangkat", j.FotoURL ? "Ada Lampiran" : "-", j.GPS, tampilJamMulai, tampilJamAkhir,
                    `${j.Tanggal} ${j.Bulan} ${j.Tahun}`, jamKerja, hariKerja
                ];
            });

            const worksheetData = [headers, ...rowsData];
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet(worksheetData);
            XLSX.utils.book_append_sheet(wb, ws, "Rekap Absensi EK");
            XLSX.writeFile(wb, `Rekap_Absensi_${String(filterNama).replace(/\s+/g, '_')}.xlsx`);
        }

        function triggerAdminCetak() {
            const pil = document.getElementById('admin-select-karyawan').value;
            if (pil === 'SEMUA') {
                generatePDFReport(cacheLogJurnal, "SEMUA");
            } else {
                const filtered = cacheLogJurnal.filter(j => j.Nama === pil);
                generatePDFReport(filtered, pil);
            }
        }

        function generatePDFReport(dataArray, namaTarget) {
            if (dataArray.length === 0) { alert("Tidak ada record data untuk dicetak!"); return; }
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
            const tableRows = [];

            dataArray.forEach((j, index) => {
                const isWfh = String(j.IzinSakit).startsWith("WFH");
                const isHadirOrWfh = j.Status === 'HADIR' || isWfh;
                
                tableRows.push([
                    index + 1,
                    `${j.Tanggal} ${String(j.Bulan).substring(0, 3)} ${j.Tahun}`,
                    isHadirOrWfh ? `${isWfh ? 'WFH' : 'Hadir'}\n(${j.JamMulai}-${j.JamAkhir})` : 'Izin',
                    isHadirOrWfh ? (j.Kegiatan || '-') : (j.IzinSakit || '-'),
                    j.GPS
                ]);
            });

            const detailUser = dataArray[0];
            const isAdminAction = (namaTarget === "SEMUA");

            doc.autoTable({
                head: [["No", "Tanggal", "Status & Jam", "Deskripsi Laporan Jurnal / Alasan", "Koordinat GPS Standard"]],
                body: tableRows,
                startY: 45,
                theme: 'striped',
                headStyles: { fillColor: [27, 77, 62], textColor: [255, 255, 255], fontSize: 9, halign: 'center' },
                didDrawPage: function (data) {
                    doc.setFont("helvetica", "bold").setFontSize(15).setTextColor(27, 77, 62);
                    doc.text("YAYASAN ELANG KATULISTIWA ADIPAVITRA", 14, 18);
                    doc.setFont("helvetica", "normal").setFontSize(8.5);
                    if (!isAdminAction) {
                        doc.text(`Nama Personel : ${detailUser.Nama} (${detailUser.Divisi} - ${detailUser.Jabatan})`, 14, 38);
                    } else {
                        doc.text(`Target Cetak    : Rekap Gabungan Semua Karyawan`, 14, 38);
                    }
                }
            });

            doc.save(`Jurnal_EK_${String(namaTarget).replace(/\s+/g, '_')}.pdf`);
        }

        setInterval(() => {
            const sek = new Date();
            if (document.getElementById('live-date')) document.getElementById('live-date').innerText = sek.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            if (document.getElementById('live-clock')) document.getElementById('live-clock').innerText = sek.toLocaleTimeString('id-ID');
        }, 1000);

        window.addEventListener('DOMContentLoaded', async () => {
            const simpananSesi = localStorage.getItem('user_session');
            if (simpananSesi) {
                try {
                    currentUser = JSON.parse(simpananSesi);
                    if (currentUser.role === 'admin') {
                        await prosesLoginSukses();
                    } else {
                        const valid = await gsRun('checkSessionValid', currentUser.rowIndex, currentUser.sessionId);
                        if (!valid) throw new Error('Sesi tidak valid');
                        aktifkanPollingSesi();
                        await prosesLoginSukses();
                    }
                } catch (e) {
                    handleLogout(true);
                    hilangkanLoadingScreen();
                }
            } else {
                currentUser = null;
                document.getElementById('page-auth').classList.remove('hidden');
                document.getElementById('box-login').classList.remove('hidden');
                hilangkanLoadingScreen();
            }
        });
        document.addEventListener('input', function(e) {
           if (e.target.id && e.target.id.startsWith('absen-')) {
               localStorage.setItem('draft_' + e.target.id, e.target.value);
           }
        });
    