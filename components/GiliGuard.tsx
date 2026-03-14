'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { 
  Phone, Shield, HeartPulse, MapPin, AlertCircle, 
  Info, Navigation, Anchor, LifeBuoy, Home, 
  Settings, Cloud, Wind, Waves, RefreshCw, X, CheckCircle2,
  Droplets, Thermometer, Sun, CloudSun, CloudRain, 
  CloudLightning, CloudFog, CloudDrizzle, ExternalLink,
  Smartphone, Download, Search, Plus, MessageSquare, Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { db, auth } from '@/lib/firebase';
import { 
  collection, addDoc, onSnapshot, query, 
  orderBy, serverTimestamp, deleteDoc, doc,
  Timestamp 
} from 'firebase/firestore';
import { 
  signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, signOut 
} from 'firebase/auth';

// --- Types ---
type Lang = 'id' | 'en';
type Page = 'beranda' | 'kontak' | 'p3k' | 'peta' | 'info' | 'lostfound';

interface LostFoundItem {
  id: string;
  type: 'lost' | 'found';
  title: string;
  description: string;
  location: string;
  contact: string;
  createdAt: any;
  status: 'active' | 'resolved';
  uid: string;
}

interface WeatherData {
  temp: number;
  apparentTemp: number;
  humidity: number;
  windSpeed: number;
  windDir: number;
  weatherCode: number;
  waveHeight: number | null;
}

// --- Constants & Translations ---
const STRINGS = {
  htitle: { id: 'Gili Trawangan SOS', en: 'Gili Trawangan SOS' },
  hsub: { id: 'Mencari lokasi GPS...', en: 'Finding GPS location...' },
  sos_sub: { id: 'Tekan darurat', en: 'Tap for emergency' },
  sos_hint: { id: 'Tekan → Konfirmasi → Langsung telepon 112', en: 'Tap → Confirm → Calls 112 directly' },
  lbl_quick: { id: 'Akses Cepat', en: 'Quick Access' },
  q1: { id: 'Kontak Darurat', en: 'Emergency Contacts' },
  q2: { id: 'Pertolongan Pertama', en: 'First Aid' },
  q3: { id: 'Fasilitas Terdekat', en: 'Nearest Facilities' },
  q4: { id: 'Ambulans 119', en: 'Ambulance 119' },
  q5: { id: 'Polisi 110', en: 'Police 110' },
  q6: { id: 'SAR Laut 115', en: 'Sea Rescue 115' },
  lbl_tips: { id: 'Tips Keselamatan', en: 'Safety Tips' },
  tips_title: { id: 'Kondisi Hari Ini', en: "Today's Conditions" },
  tip1: { id: 'Selalu pakai pelampung saat aktivitas laut', en: 'Always wear a life jacket during water activities' },
  tip2: { id: 'Tidak ada kendaraan bermotor – cidomo & sepeda saja', en: 'No motorised vehicles on Gili – cidomo & bicycle only' },
  tip3: { id: 'Minum air putih min. 2L/hari di cuaca panas ini', en: 'Drink minimum 2L of water per day in this heat' },
  tip4: { id: 'Snorkeling: selalu bersama teman, jangan sendiri', en: 'Snorkelling: always go with a buddy, never alone' },
  tip5: { id: 'Evakuasi ke RS: cidomo → perahu → Pelabuhan Bangsal (±45 mnt)', en: 'Hospital evacuation: cidomo → boat → Bangsal Port (±45 min)' },
  tip6: { id: 'Waspada arus kuat di sisi timur pulau saat pasang', en: 'Beware of strong currents on the east side during high tide' },
  tip7: { id: 'Simpan nomor darurat di kontak cepat ponsel Anda', en: 'Save emergency numbers in your phone speed dial' },
  tip8: { id: 'Jangan menyentuh atau menginjak terumbu karang', en: 'Do not touch or step on coral reefs' },
  tip9: { id: 'Gunakan tabir surya ramah lingkungan (reef-safe)', en: 'Use eco-friendly (reef-safe) sunscreen' },
  tip10: { id: 'Hati-hati saat bersepeda di malam hari, jalanan gelap', en: 'Be careful when cycling at night, roads are dark' },
  nav1: { id: 'Beranda', en: 'Home' },
  nav2: { id: 'Kontak', en: 'Contacts' },
  nav3: { id: 'P3K', en: 'First Aid' },
  nav4: { id: 'Peta', en: 'Map' },
  nav5: { id: 'Info', en: 'Info' },
  nav6: { id: 'Hilang/Temu', en: 'Lost/Found' },
  lf_title: { id: 'Barang Hilang & Temuan', en: 'Lost & Found Items' },
  lf_lost: { id: 'HILANG', en: 'LOST' },
  lf_found: { id: 'TEMUAN', en: 'FOUND' },
  lf_report: { id: 'Lapor Barang', en: 'Report Item' },
  lf_empty: { id: 'Belum ada laporan barang', en: 'No item reports yet' },
  lf_form_title: { id: 'Lapor Barang Baru', en: 'Report New Item' },
  lf_type: { id: 'Jenis Laporan', en: 'Report Type' },
  lf_item_name: { id: 'Nama Barang', en: 'Item Name' },
  lf_item_desc: { id: 'Deskripsi (Warna, Ciri khas)', en: 'Description (Color, Features)' },
  lf_item_loc: { id: 'Lokasi (Terakhir dilihat/ditemukan)', en: 'Location (Last seen/found)' },
  lf_item_contact: { id: 'Kontak (WA/Telepon)', en: 'Contact (WA/Phone)' },
  lf_submit: { id: 'KIRIM LAPORAN', en: 'SUBMIT REPORT' },
  lf_success: { id: 'Laporan berhasil dikirim!', en: 'Report submitted successfully!' },
  lf_delete_confirm: { id: 'Hapus laporan ini?', en: 'Delete this report?' },
  lf_login_req: { id: 'Silakan masuk untuk melapor barang', en: 'Please sign in to report items' },
  lf_login_btn: { id: 'Masuk dengan Google', en: 'Sign in with Google' },
  lf_logout: { id: 'Keluar', en: 'Sign Out' },
  m_title: { id: 'Hubungi 112 Sekarang?', en: 'Call 112 Now?' },
  m_desc: { id: 'Aplikasi akan langsung menelepon 112 — darurat nasional terhubung ke polisi, ambulans, dan SAR.', en: 'The app will directly call 112 — the national emergency number connected to police, ambulance and SAR.' },
  m_cancel: { id: 'Batal', en: 'Cancel' },
  m_call: { id: '📞 TELEPON 112', en: '📞 CALL 112' },
  m_abort: { id: '✕ Batalkan Panggilan', en: '✕ Cancel Call' },
  cd_text: { id: 'Menelepon dalam', en: 'Calling in' },
  cd_sec: { id: 'detik...', en: 'seconds...' },
  sent_title: { id: 'MENELEPON 112...', en: 'CALLING 112...' },
  sent_close: { id: 'Tutup', en: 'Close' },
  hist_empty: { id: 'Belum ada aktivasi SOS', en: 'No SOS activations yet' },
  emg_txt: { id: 'Darurat nasional · 24 jam · Semua darurat', en: 'National emergency · 24 hours · All emergencies' },
  c1r: { id: 'Klinik di pulau · Terverifikasi', en: 'On-island clinic · Verified' },
  c2r: { id: 'Klinik di pulau · Terverifikasi', en: 'On-island clinic · Verified' },
  c3r: { id: 'RS terdekat · 45 mnt dengan speedboat', en: 'Nearest hospital · 45 min by speedboat' },
  c4r: { id: 'Polisi di pulau · 24 jam', en: 'On-island police · 24 hours' },
  c5r: { id: 'Tim SAR Mataram · Evakuasi laut', en: 'Mataram SAR Team · Sea evacuation' },
  c6r: { id: 'Klinik di pulau · 24 jam', en: 'On-island clinic · 24 hours' },
  c7r: { id: 'Klinik di pulau · Terverifikasi', en: 'On-island clinic · Verified' },
  c8r: { id: 'Damkar KLU · Respon cepat', en: 'North Lombok Fire Dept · Fast response' },
  c9r: { id: 'Unit Damkar Pulau · Respon lokal', en: 'Island Fire Unit · Local response' },
  lbl_med: { id: 'Kontak Medis', en: 'Medical Contacts' },
  lbl_pol: { id: 'Polisi & Keamanan', en: 'Police & Security' },
  lbl_fire: { id: 'Pemadam Kebakaran', en: 'Fire Department' },
  lbl_sar: { id: 'SAR & Evakuasi', en: 'SAR & Evacuation' },
  lbl_hist: { id: 'Riwayat SOS', en: 'SOS History' },
  lbl_about: { id: 'Tentang', en: 'About' },
  lbl_rules: { id: 'Aturan Gili', en: 'Gili Rules' },
  lbl_links: { id: 'Tautan Berguna', en: 'Useful Links' },
  rule1: { id: '🚫 Tanpa Kendaraan Bermotor', en: '🚫 No Motorized Vehicles' },
  rule2: { id: '👕 Berpakaian Sopan di Desa', en: '👕 Dress Modestly in Village' },
  rule3: { id: '🐢 Jangan Sentuh Penyu', en: '🐢 Do Not Touch Turtles' },
  rule4: { id: '💧 Hemat Air Tawar', en: '💧 Conserve Fresh Water' },
  link1: { id: 'Jadwal Fastboat', en: 'Fastboat Schedule' },
  link2: { id: 'Peta Interaktif Gili', en: 'Gili Interactive Map' },
  link3: { id: 'Laporan Sampah', en: 'Waste Report' },
  c10r: { id: 'Penyelamatan Hewan · Gili Trawangan', en: 'Animal Rescue · Gili Trawangan' },
  lbl_animal: { id: 'Darurat Hewan', en: 'Animal Emergency' },
  pwa_title: { id: 'Pasang GiliGuard', en: 'Install GiliGuard' },
  pwa_desc: { id: 'Akses cepat fitur darurat langsung dari layar utama Anda, bahkan saat offline.', en: 'Quick access to emergency features directly from your home screen, even offline.' },
  pwa_btn: { id: 'Pasang Sekarang', en: 'Install Now' },
  ver: { id: 'Versi 2.2 – Ultra Comprehensive', en: 'Version 2.2 – Ultra Comprehensive' },
  mission: { id: 'Dibuat untuk keselamatan Gili · Gratis selamanya', en: 'Built for Gili safety · Free forever' },
  footer: { id: 'Untuk wisatawan & warga lokal · Gili Trawangan, NTB', en: 'Built for tourists & locals · Gili Trawangan, NTB' },
  about_desc: { 
    id: 'GiliGuard adalah aplikasi pendamping keselamatan digital yang dirancang khusus untuk wisatawan dan warga lokal di Gili Trawangan. Fokus utama kami adalah mempercepat respon darurat di pulau yang tidak memiliki kendaraan bermotor ini.', 
    en: 'GiliGuard is a digital safety companion app designed specifically for tourists and locals on Gili Trawangan. Our main focus is to accelerate emergency response on this motor-free island.' 
  },
  about_feature1: { id: 'Akses instan ke nomor darurat 112.', en: 'Instant access to 112 emergency numbers.' },
  about_feature2: { id: 'Panduan P3K untuk situasi kritis di laut & darat.', en: 'First aid guides for critical sea & land situations.' },
  about_feature3: { id: 'Peta fasilitas medis & keamanan terdekat.', en: 'Map of nearest medical & security facilities.' },
  about_feature4: { id: 'Laporan barang hilang/temu berbasis komunitas.', en: 'Community-based lost & found reporting.' },
  about_dev: { id: 'Dikembangkan dengan ❤️ untuk Gili Trawangan.', en: 'Developed with ❤️ for Gili Trawangan.' },
  lbl_legal: { id: 'Legal & Privasi', en: 'Legal & Privacy' },
  lbl_dev: { id: 'Profil Pengembang', en: 'Developer Profile' },
  dev_name: { id: 'Zohidy', en: 'Zohidy' },
  dev_role: { id: 'Full-stack Developer & Gili Enthusiast', en: 'Full-stack Developer & Gili Enthusiast' },
  dev_desc: { id: 'Membangun solusi digital untuk dampak sosial dan keselamatan komunitas.', en: 'Building digital solutions for social impact and community safety.' },
  legal_terms_title: { id: 'Syarat & Ketentuan', en: 'Terms of Use' },
  legal_terms_desc: { id: 'GiliGuard adalah alat bantu informasi. Dalam keadaan darurat nyata, selalu prioritaskan instruksi dari petugas berwenang di lapangan.', en: 'GiliGuard is an information tool. In real emergencies, always prioritize instructions from authorities on the ground.' },
  legal_privacy_title: { id: 'Kebijakan Privasi', en: 'Privacy Policy' },
  legal_privacy_desc: { id: 'Kami menghargai privasi Anda. Data login Google hanya digunakan untuk identifikasi laporan Lost & Found. Lokasi GPS Anda hanya diproses secara lokal untuk membantu Anda memberikan informasi ke operator 112.', en: 'We value your privacy. Google login data is only used for Lost & Found identification. Your GPS location is processed locally to help you provide info to 112 operators.' },
};

const P3K_GUIDES = [
  {
    id: 'p1',
    icon: '🌊',
    title: { id: 'Tenggelam / Hampir tenggelam', en: 'Drowning / Near-drowning' },
    tags: ['KRITIS', 'LAUT'],
    steps: [
      { id: 's1', text: { id: 'Pastikan kamu aman dahulu. Jangan terjun — gunakan pelampung, tali, atau benda terapung.', en: "Make sure YOU are safe first. Don't jump in — use a life ring, rope, or floating object." } },
      { id: 's2', text: { id: 'Keluarkan korban dari air. Posisi terlentang di permukaan datar. Minta bantuan serentak.', en: 'Pull victim out of water. Lay flat on their back. Call for help simultaneously.' } },
      { id: 's3', text: { id: 'Cek napas. Jika tidak bernapas: CPR — 30 tekanan dada + 2 napas buatan.', en: 'Check breathing. If not breathing: CPR — 30 compressions + 2 breaths.' } }
    ],
    warning: { id: 'Hubungi klinik atau SAR (115) segera!', en: 'Call clinic or SAR (115) immediately!' }
  },
  {
    id: 'p2',
    icon: '🪸',
    title: { id: 'Sengatan ubur-ubur & karang', en: 'Jellyfish & Coral sting' },
    tags: ['SEDANG', 'LAUT'],
    steps: [
      { id: 's1', text: { id: 'Jangan gosok area sengatan. Lepas tentakel dengan kartu/penjepit.', en: 'Do NOT rub the sting area. Remove tentacles with a card or tweezers.' } },
      { id: 's2', text: { id: 'Bilas dengan air laut (bukan air tawar). Siram cuka jika ada.', en: 'Rinse with seawater (NOT fresh water). Use vinegar if available.' } }
    ],
    warning: { id: 'Jika sesak napas atau bengkak parah — segera ke klinik!', en: 'If shortness of breath or severe swelling — go to clinic!' }
  },
  {
    id: 'p3',
    icon: '☀️',
    title: { id: 'Heatstroke / Kelelahan Panas', en: 'Heatstroke / Heat Exhaustion' },
    tags: ['SERIUS', 'DARAT'],
    steps: [
      { id: 's1', text: { id: 'Pindahkan ke tempat teduh dan dingin. Lepaskan pakaian berlebih.', en: 'Move to a cool, shaded area. Remove excess clothing.' } },
      { id: 's2', text: { id: 'Dinginkan tubuh dengan handuk basah atau air. Beri minum jika sadar.', en: 'Cool the body with wet towels or water. Give water if conscious.' } }
    ],
    warning: { id: 'Jika suhu tubuh sangat tinggi atau pingsan, ini darurat medis!', en: 'If body temperature is very high or unconscious, this is a medical emergency!' }
  },
  {
    id: 'p4',
    icon: '🚲',
    title: { id: 'Luka Jatuh / Pendarahan', en: 'Cuts / Bleeding' },
    tags: ['UMUM', 'DARAT'],
    steps: [
      { id: 's1', text: { id: 'Tekan luka dengan kain bersih selama 5-10 menit untuk menghentikan darah.', en: 'Apply pressure to the wound with a clean cloth for 5-10 minutes to stop bleeding.' } },
      { id: 's2', text: { id: 'Bersihkan dengan air mengalir. Gunakan antiseptik jika tersedia.', en: 'Clean with running water. Use antiseptic if available.' } }
    ],
    warning: { id: 'Luka dalam atau kotor butuh suntikan tetanus di klinik.', en: 'Deep or dirty wounds need a tetanus shot at the clinic.' }
  },
  {
    id: 'p5',
    icon: '🐈',
    title: { id: 'Darurat Hewan (Kucing/Anjing)', en: 'Animal Emergency (Cat/Dog)' },
    tags: ['HEWAN', 'LUNI'],
    steps: [
      { id: 's1', text: { id: 'Jangan panik. Dekati hewan dengan tenang agar tidak digigit/dicakar.', en: 'Do not panic. Approach the animal calmly to avoid being bitten/scratched.' } },
      { id: 's2', text: { id: 'Jika terluka, bungkus dengan kain lembut. Hubungi LUNI Lombok segera.', en: 'If injured, wrap in a soft cloth. Contact LUNI Lombok immediately.' } }
    ],
    warning: { id: 'LUNI Lombok adalah satu-satunya penyelamat hewan di Gili T.', en: 'LUNI Lombok is the only animal rescue on Gili T.' }
  },
  {
    id: 'p6',
    icon: '🦴',
    title: { id: 'Patah Tulang / Keseleo', en: 'Fracture / Sprain' },
    tags: ['SERIUS', 'DARAT'],
    steps: [
      { id: 's1', text: { id: 'Jangan gerakkan bagian yang cedera. Gunakan bidai (kayu/papan) jika harus pindah.', en: 'Do not move the injured part. Use a splint (wood/board) if you must move.' } },
      { id: 's2', text: { id: 'Kompres dingin untuk kurangi bengkak. Jangan urut/pijat paksa.', en: 'Apply cold compress to reduce swelling. Do not massage or force movement.' } }
    ],
    warning: { id: 'Segera ke klinik untuk Rontgen/X-Ray.', en: 'Go to the clinic immediately for an X-Ray.' }
  },
  {
    id: 'p7',
    icon: '😵',
    title: { id: 'Pingsan / Tidak Sadar', en: 'Fainting / Unconscious' },
    tags: ['KRITIS', 'UMUM'],
    steps: [
      { id: 's1', text: { id: 'Baringkan korban, angkat kaki lebih tinggi dari jantung (30cm).', en: 'Lay the victim down, raise legs higher than the heart (30cm).' } },
      { id: 's2', text: { id: 'Longgarkan pakaian. Beri udara segar. Jangan beri minum saat pingsan.', en: 'Loosen clothing. Provide fresh air. Do not give water while unconscious.' } }
    ],
    warning: { id: 'Jika tidak bangun dalam 1 menit, hubungi ambulans!', en: 'If they do not wake up within 1 minute, call an ambulance!' }
  },
  {
    id: 'p8',
    icon: '🥨',
    title: { id: 'Tersedak', en: 'Choking' },
    tags: ['KRITIS', 'UMUM'],
    steps: [
      { id: 's1', text: { id: 'Minta korban batuk keras. Jika gagal, lakukan Maneuver Heimlich.', en: 'Ask the victim to cough hard. If it fails, perform the Heimlich Maneuver.' } },
      { id: 's2', text: { id: 'Tekan perut di atas pusar dengan kepalan tangan ke arah atas.', en: 'Apply abdominal thrusts above the navel with a fist in an upward motion.' } }
    ],
    warning: { id: 'Jika pingsan, segera lakukan CPR!', en: 'If they pass out, start CPR immediately!' }
  },
  {
    id: 'p9',
    icon: '🤢',
    title: { id: 'Keracunan Makanan', en: 'Food Poisoning' },
    tags: ['SEDANG', 'UMUM'],
    steps: [
      { id: 's1', text: { id: 'Minum banyak air putih atau oralit untuk cegah dehidrasi.', en: 'Drink plenty of water or ORS to prevent dehydration.' } },
      { id: 's2', text: { id: 'Istirahat total. Hindari makanan padat sementara.', en: 'Full rest. Avoid solid foods temporarily.' } }
    ],
    warning: { id: 'Jika muntah darah atau diare parah, segera ke klinik!', en: 'If vomiting blood or severe diarrhea, go to the clinic immediately!' }
  },
  {
    id: 'p10',
    icon: '🔥',
    title: { id: 'Luka Bakar', en: 'Burns' },
    tags: ['SEDANG', 'UMUM'],
    steps: [
      { id: 's1', text: { id: 'Siram dengan air mengalir (suhu ruang) selama 20 menit. Jangan pakai es.', en: 'Rinse with running water (room temp) for 20 minutes. Do not use ice.' } },
      { id: 's2', text: { id: 'Tutup longgar dengan plastik wrapping bersih atau kain steril.', en: 'Cover loosely with clean plastic wrap or sterile cloth.' } }
    ],
    warning: { id: 'Jangan pecahkan lepuhan. Jangan oleskan odol/mentega.', en: 'Do not pop blisters. Do not apply toothpaste or butter.' }
  }
];

const EMERGENCY_CONTACTS = [
  { name: 'Prima Medika Gili', role: 'c1r', num: '+6285186678911', icon: '🏥', type: 'med' },
  { name: 'Blue Island Medical', role: 'c7r', num: '+6281997733332', icon: '🏥', type: 'med' },
  { name: 'Warna Medica Gili', role: 'c2r', num: '+6287862060247', icon: '🏥', type: 'med' },
  { name: 'LUNI Lombok (Animal)', role: 'c10r', num: '+6281239495308', icon: '🐈', type: 'med' },
  { name: 'Klinik Gili Trawangan', role: 'c6r', num: '+6281997733331', icon: '🏥', type: 'med' },
  { name: 'Polisi Gili Indah', role: 'c4r', num: '+6281917444441', icon: '👮', type: 'pol' },
  { name: 'Damkar Gili Trawangan', role: 'c9r', num: '+6281917444441', icon: '🚒', type: 'fire' },
  { name: 'Damkar Lombok Utara', role: 'c8r', num: '+623706123113', icon: '🔥', type: 'fire' },
  { name: 'RSUD Tanjung', role: 'c3r', num: '+628123789420', icon: '🏨', type: 'med' },
  { name: 'Basarnas Mataram', role: 'c5r', num: '+62370633253', icon: '⚓', type: 'sar' },
];

// --- Components ---

const WEATHER_DESCRIPTIONS: Record<number, { id: string, en: string }> = {
  0: { id: 'Langit cerah', en: 'Clear sky' },
  1: { id: 'Cerah berawan', en: 'Mainly clear' },
  2: { id: 'Berawan', en: 'Partly cloudy' },
  3: { id: 'Mendung', en: 'Overcast' },
  45: { id: 'Kabut', en: 'Fog' },
  48: { id: 'Kabut rime', en: 'Depositing rime fog' },
  51: { id: 'Gerimis ringan', en: 'Light drizzle' },
  53: { id: 'Gerimis sedang', en: 'Moderate drizzle' },
  55: { id: 'Gerimis lebat', en: 'Dense drizzle' },
  61: { id: 'Hujan ringan', en: 'Slight rain' },
  63: { id: 'Hujan sedang', en: 'Moderate rain' },
  65: { id: 'Hujan lebat', en: 'Heavy rain' },
  80: { id: 'Hujan rintik', en: 'Slight rain showers' },
  81: { id: 'Hujan deras', en: 'Moderate rain showers' },
  82: { id: 'Hujan sangat deras', en: 'Violent rain showers' },
  95: { id: 'Badai petir', en: 'Thunderstorm' },
};

const ContactCard = ({ c, t, lang }: { c: any, t: any, lang: Lang }) => (
  <motion.div 
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    className="bg-gradient-to-br from-white/[0.06] to-white/[0.01] border border-white/[0.08] rounded-2xl p-4 flex items-center gap-4 hover:bg-white/[0.08] transition-all group relative overflow-hidden"
  >
    <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-transparent via-[#3d9bff] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
    <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-2xl group-hover:rotate-6 transition-transform shadow-inner">{c.icon}</div>
    <div className="flex-1 min-w-0">
      <div className="text-sm font-black truncate text-white tracking-tight">{c.name}</div>
      <div className="text-[10px] text-[#7a9ab8] font-bold uppercase tracking-wider opacity-70">{t(c.role as any)}</div>
      <div className="text-[11px] text-[#3d9bff] font-mono font-bold mt-1 tracking-tight flex items-center gap-1">
        <div className="w-1 h-1 rounded-full bg-[#3d9bff]/40" />
        {c.num}
      </div>
    </div>
    <button 
      onClick={() => window.location.href = `tel:${c.num}`} 
      className="w-10 h-10 rounded-full bg-[#00e5b0]/10 flex items-center justify-center text-[#00e5b0] hover:bg-[#00e5b0] hover:text-[#080f1e] transition-all shadow-lg shadow-[#00e5b0]/10"
    >
      <Phone className="w-4 h-4" />
    </button>
  </motion.div>
);

const WeatherCard = ({ lang, weather, loading, onRefresh }: { lang: Lang, weather: WeatherData | null, loading: boolean, onRefresh: () => void }) => {
  if (loading && !weather) return (
    <div className="bg-[#121f35]/50 border border-white/10 rounded-3xl p-8 flex items-center justify-center mb-6 h-48">
      <RefreshCw className="w-6 h-6 text-[#7a9ab8] animate-spin" />
    </div>
  );

  if (!weather) return null;

  const desc = WEATHER_DESCRIPTIONS[weather.weatherCode] || { id: 'Kondisi normal', en: 'Normal conditions' };

  const getWeatherIcon = (code: number) => {
    if (code === 0) return <Sun className="w-8 h-8 text-yellow-400" />;
    if (code === 1 || code === 2) return <CloudSun className="w-8 h-8 text-yellow-200" />;
    if (code === 3) return <Cloud className="w-8 h-8 text-slate-400" />;
    if (code === 45 || code === 48) return <CloudFog className="w-8 h-8 text-slate-300" />;
    if (code >= 51 && code <= 55) return <CloudDrizzle className="w-8 h-8 text-blue-300" />;
    if (code >= 61 && code <= 65) return <CloudRain className="w-8 h-8 text-blue-400" />;
    if (code >= 80 && code <= 82) return <CloudRain className="w-8 h-8 text-blue-400" />;
    if (code >= 95) return <CloudLightning className="w-8 h-8 text-amber-400" />;
    return <Sun className="w-8 h-8 text-yellow-400" />;
  };

  return (
    <div className="bg-gradient-to-br from-[#1a2a44] to-[#0d1829] border border-white/10 rounded-[2rem] p-6 relative overflow-hidden mb-8 shadow-2xl shadow-black/40">
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#3d9bff] via-[#00e5b0] to-[#3d9bff] animate-gradient-x opacity-50" />
      
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center shadow-inner border border-white/5">
            {getWeatherIcon(weather.weatherCode)}
          </div>
          <div>
            <div className="text-[10px] text-[#7a9ab8] font-black uppercase tracking-[0.2em] mb-1">Gili Trawangan</div>
            <div className="text-xs font-bold text-[#00e5b0] flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#00e5b0] animate-pulse" />
              {desc[lang].toUpperCase()}
            </div>
          </div>
        </div>
        <button 
          onClick={onRefresh} 
          disabled={loading}
          className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl transition-all text-[#7a9ab8] hover:text-white disabled:opacity-50 border border-white/5"
        >
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
        </button>
      </div>

      <div className="flex items-baseline gap-2 mb-8">
        <span className="text-6xl font-black text-white tracking-tighter drop-shadow-2xl">
          {Math.round(weather.temp)}°
        </span>
        <div className="flex flex-col">
          <span className="text-sm font-black text-[#7a9ab8] uppercase tracking-widest">Celsius</span>
          <span className="text-[10px] font-bold text-[#3d6080]">
            {lang === 'id' ? 'Terasa' : 'Feels'} {Math.round(weather.apparentTemp)}°
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          { icon: Waves, label: 'Waves', val: `${weather.waveHeight?.toFixed(1)}m`, color: 'text-blue-400', bg: 'bg-blue-400/10' },
          { icon: Wind, label: 'Wind', val: `${Math.round(weather.windSpeed)} km/h`, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
          { icon: Droplets, label: 'Humidity', val: `${weather.humidity}%`, color: 'text-cyan-400', bg: 'bg-cyan-400/10' },
          { icon: Navigation, label: 'Direction', val: `${weather.windDir}°`, color: 'text-orange-400', bg: 'bg-orange-400/10' },
        ].map((item, i) => (
          <div key={i} className="bg-white/[0.03] border border-white/[0.05] rounded-2xl p-3.5 flex items-center gap-3">
            <div className={cn("p-2 rounded-xl", item.bg)}>
              <item.icon className={cn("w-4 h-4", item.color)} />
            </div>
            <div>
              <div className="text-[9px] text-[#3d6080] uppercase font-black tracking-wider">{item.label}</div>
              <div className="text-sm font-black text-white font-mono">{item.val}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function GiliGuard() {
  const [lang, setLang] = useState<Lang>('id');
  const [activePage, setActivePage] = useState<Page>('beranda');
  const [showSOSModal, setShowSOSModal] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isSOSSent, setIsSOSSent] = useState(false);
  const [sosTimer, setSosTimer] = useState(0);
  const [coords, setCoords] = useState<string>('--');
  const [history, setHistory] = useState<{ time: string, coords: string }[]>([]);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  // Lost & Found state
  const [lfItems, setLfItems] = useState<LostFoundItem[]>([]);
  const [showLfForm, setShowLfForm] = useState(false);
  const [lfLoading, setLfLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [newLf, setNewLf] = useState({
    type: 'lost' as 'lost' | 'found',
    title: '',
    description: '',
    location: '',
    contact: ''
  });

  // Auth setup
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return unsub;
  }, []);

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login error:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  // Firestore setup for Lost & Found
  useEffect(() => {
    const q = query(collection(db, 'lost_and_found'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const items: LostFoundItem[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as LostFoundItem);
      });
      setLfItems(items);
      setLfLoading(false);
    }, (error) => {
      console.error("Firestore error:", error);
      setLfLoading(false);
    });
    return unsub;
  }, []);

  const handleLfSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    try {
      await addDoc(collection(db, 'lost_and_found'), {
        ...newLf,
        createdAt: serverTimestamp(),
        status: 'active',
        uid: user.uid
      });
      setShowLfForm(false);
      setNewLf({ type: 'lost', title: '', description: '', location: '', contact: '' });
      alert(t('lf_success'));
    } catch (error) {
      console.error("Error adding document: ", error);
    }
  };

  const deleteLfItem = async (id: string) => {
    if (confirm(t('lf_delete_confirm'))) {
      try {
        await deleteDoc(doc(db, 'lost_and_found', id));
      } catch (error) {
        console.error("Error deleting document: ", error);
      }
    }
  };

  // Weather state moved to main component
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);

  const fetchWeather = useCallback(async () => {
    setWeatherLoading(true);
    try {
      const lat = -8.3535, lon = 116.0416;
      let wData: any = null;
      try {
        const wRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,weather_code,apparent_temperature&timezone=Asia%2FMakassar`);
        if (wRes.ok) wData = await wRes.json();
      } catch (e) { console.warn('Forecast API failed', e); }

      let mData: any = null;
      try {
        const mRes = await fetch(`https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&current=wave_height,wind_wave_height&timezone=Asia%2FMakassar`);
        if (mRes.ok) mData = await mRes.json();
      } catch (e) { console.warn('Marine API failed', e); }
      
      if (wData?.current) {
        setWeather({
          temp: wData.current.temperature_2m,
          apparentTemp: wData.current.apparent_temperature || wData.current.temperature_2m,
          humidity: wData.current.relative_humidity_2m,
          windSpeed: wData.current.wind_speed_10m,
          windDir: wData.current.wind_direction_10m,
          weatherCode: wData.current.weather_code,
          waveHeight: mData?.current?.wave_height || mData?.current?.wind_wave_height || 0.5
        });
      } else {
        setWeather({
          temp: 29, apparentTemp: 32, humidity: 75, windSpeed: 12, windDir: 180, weatherCode: 0, waveHeight: 0.5
        });
      }
    } catch (e) {
      console.error('Weather fetch error', e);
    } finally {
      setWeatherLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWeather();
  }, [fetchWeather]);

  // Dynamic Safety Tips based on weather
  const getDynamicTips = () => {
    const baseTips = [
      STRINGS.tip1[lang], STRINGS.tip2[lang], STRINGS.tip3[lang], 
      STRINGS.tip4[lang], STRINGS.tip5[lang], STRINGS.tip6[lang], 
      STRINGS.tip7[lang], STRINGS.tip8[lang], STRINGS.tip9[lang], 
      STRINGS.tip10[lang]
    ];

    if (!weather) return baseTips;

    const dynamicTips = [...baseTips];

    // Weather specific adjustments
    if (weather.weatherCode >= 51) { // Rain/Drizzle
      dynamicTips[0] = lang === 'id' ? '⚠️ Hujan: Jalanan licin, hati-hati bersepeda' : '⚠️ Rain: Slippery roads, be careful cycling';
      dynamicTips[5] = lang === 'id' ? '⚠️ Arus laut mungkin lebih kuat saat hujan' : '⚠️ Sea currents may be stronger during rain';
    }

    if (weather.temp > 32) { // Very hot
      dynamicTips[2] = lang === 'id' ? '🔥 Cuaca sangat panas! Minum air min. 3L/hari' : '🔥 Extremely hot! Drink min. 3L of water/day';
    }

    if (weather.waveHeight && weather.waveHeight > 1.2) { // High waves
      dynamicTips[3] = lang === 'id' ? '🌊 Gelombang tinggi! Hindari snorkeling di area terbuka' : '🌊 High waves! Avoid snorkeling in open areas';
    }

    if (weather.windSpeed > 20) { // Strong wind
      dynamicTips[1] = lang === 'id' ? '💨 Angin kencang! Waspada pohon tumbang & debu' : '💨 Strong wind! Beware of falling trees & dust';
    }

    return dynamicTips;
  };

  // PWA Install Prompt
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  // Show install prompt after 10 seconds if available
  useEffect(() => {
    if (deferredPrompt) {
      const timer = setTimeout(() => {
        setShowInstallPrompt(true);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [deferredPrompt]);

  // GPS Tracking
  useEffect(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => setCoords(`${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`),
      () => setCoords('Gili Trawangan, NTB')
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const triggerSOS = useCallback(() => {
    setShowSOSModal(false);
    setIsSOSSent(true);
    setSosTimer(0);
    setHistory(prev => [{ time: new Date().toLocaleTimeString(), coords }, ...prev]);
    window.location.href = 'tel:112';
  }, [coords]);

  // SOS Countdown Logic
  useEffect(() => {
    if (countdown === null || countdown <= 0) return;

    const timer = setTimeout(() => {
      setCountdown(prev => {
        if (prev === 1) {
          triggerSOS();
          return null;
        }
        return prev !== null ? prev - 1 : null;
      });
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, triggerSOS]);

  // SOS Timer Logic
  useEffect(() => {
    if (!isSOSSent) return;
    const timer = setInterval(() => setSosTimer(prev => prev + 1), 1000);
    return () => clearInterval(timer);
  }, [isSOSSent]);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const t = (key: keyof typeof STRINGS) => STRINGS[key][lang];

  return (
    <div className="max-w-md mx-auto h-[100dvh] bg-[#080f1e] text-[#ddeeff] flex flex-col relative overflow-hidden">
      
      {/* Header */}
      <header className="flex-shrink-0 bg-[#0d1829]/90 backdrop-blur-xl border-b border-white/10 p-3 pt-5 flex items-center gap-3 z-30 sticky top-0 shadow-2xl shadow-black/20">
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-tr from-[#ff3c3c] to-[#3d9bff] rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
          <div className="relative w-9 h-9 bg-[#0d1829] border border-white/10 rounded-xl flex items-center justify-center text-[#ff3c3c] shadow-xl overflow-hidden">
            <Shield className="w-5 h-5 fill-[#ff3c3c]/10" />
            <div className="absolute inset-0 bg-gradient-to-tr from-[#ff3c3c]/10 to-transparent pointer-events-none" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="text-sm font-black tracking-tighter text-white uppercase italic">Gili</span>
            <span className="text-sm font-black tracking-tighter text-[#3d9bff] uppercase italic">Guard</span>
            <div className="w-1 h-1 rounded-full bg-[#00e5b0] animate-pulse ml-1" />
          </div>
          <div className="text-[9px] text-[#7a9ab8] font-bold uppercase tracking-[0.15em] opacity-60 flex items-center gap-1">
            <MapPin className="w-2 h-2" />
            {coords}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-white/5 border border-white/5 rounded-xl overflow-hidden p-0.5">
            <button 
              onClick={() => setLang('id')}
              className={cn("px-2 py-1 text-[9px] font-black transition-all rounded-lg", lang === 'id' ? "bg-[#3d9bff] text-white" : "text-[#3d6080]")}
            >ID</button>
            <button 
              onClick={() => setLang('en')}
              className={cn("px-2 py-1 text-[9px] font-black transition-all rounded-lg", lang === 'en' ? "bg-[#3d9bff] text-white" : "text-[#3d6080]")}
            >EN</button>
          </div>
          <button 
            onClick={() => setActivePage('info')}
            className={cn(
              "p-2 rounded-xl border transition-all active:scale-95",
              activePage === 'info' 
                ? "bg-[#3d9bff] border-[#3d9bff] text-white shadow-lg shadow-[#3d9bff]/20" 
                : "bg-white/5 border-white/5 text-[#7a9ab8]"
            )}
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Scroll Area */}
      <main className="flex-1 overflow-y-auto p-5 pb-32 scrollbar-hide">
        <AnimatePresence mode="wait">
          
          {/* PAGE: BERANDA */}
          {activePage === 'beranda' && (
            <motion.div key="beranda" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <WeatherCard lang={lang} weather={weather} loading={weatherLoading} onRefresh={fetchWeather} />
              
              <div className="flex flex-col items-center gap-4 py-8 mb-10 relative">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#ff3c3c]/5 to-transparent pointer-events-none" />
                <div className="w-48 h-48 rounded-full bg-[#ff3c3c]/5 flex items-center justify-center relative">
                  <motion.div 
                    animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute inset-0 rounded-full border-2 border-[#ff3c3c]/20" 
                  />
                  <motion.div 
                    animate={{ scale: [1, 1.5, 1], opacity: [0.1, 0.2, 0.1] }}
                    transition={{ duration: 3, repeat: Infinity }}
                    className="absolute inset-[-12px] rounded-full border border-[#ff3c3c]/10" 
                  />
                  <button 
                    onClick={() => setShowSOSModal(true)}
                    className="w-36 h-36 rounded-full bg-gradient-to-br from-[#ff6060] via-[#ff3c3c] to-[#c81414] shadow-[0_0_60px_rgba(255,60,60,0.5)] flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform z-10 border-4 border-white/10"
                  >
                    <div className="text-4xl font-black text-white tracking-widest drop-shadow-2xl">SOS</div>
                    <div className="text-[10px] text-white/80 font-black uppercase tracking-[0.2em]">{t('sos_sub')}</div>
                  </button>
                </div>
                <div className="text-[10px] text-[#3d6080] font-black uppercase tracking-widest text-center max-w-[200px] leading-relaxed opacity-60">{t('sos_hint')}</div>
              </div>

              {/* Community Section */}
              <div className="mb-10">
                <div className="text-[11px] font-black text-[#3d6080] uppercase tracking-[0.2em] mb-4 px-1 font-mono flex items-center gap-2">
                  <div className="w-8 h-[1px] bg-[#3d6080]/30" />
                  {lang === 'id' ? 'KOMUNITAS' : 'COMMUNITY'}
                </div>
                <button 
                  onClick={() => setActivePage('lostfound')}
                  className="w-full bg-gradient-to-br from-[#121f35] to-[#0d1829] border border-white/5 rounded-[2rem] p-5 flex items-center gap-5 hover:border-[#3d9bff]/30 transition-all active:scale-[0.98] group shadow-xl"
                >
                  <div className="w-14 h-14 bg-[#3d9bff]/10 rounded-2xl flex items-center justify-center text-[#3d9bff] group-hover:scale-110 transition-transform">
                    <Search className="w-7 h-7" />
                  </div>
                  <div className="text-left flex-1">
                    <div className="text-sm font-black text-white uppercase tracking-tight mb-1">{t('lf_title')}</div>
                    <p className="text-[11px] text-[#7a9ab8] leading-tight font-medium">{lang === 'id' ? 'Cari atau lapor barang hilang/temuan di pulau.' : 'Search or report lost/found items on the island.'}</p>
                  </div>
                  <div className="w-8 h-8 bg-white/5 rounded-full flex items-center justify-center">
                    <Navigation className="w-4 h-4 text-[#3d9bff] rotate-90" />
                  </div>
                </button>
              </div>

              <div className="text-[11px] font-black text-[#3d6080] uppercase tracking-[0.2em] mb-4 px-1 font-mono flex items-center gap-2">
                <div className="w-8 h-[1px] bg-[#3d6080]/30" />
                {t('lbl_quick')}
              </div>
              <div className="grid grid-cols-3 gap-3 mb-10">
                {[
                  { icon: '📞', label: t('q1'), page: 'kontak', color: 'from-blue-500/20 to-blue-600/5' },
                  { icon: '🩹', label: t('q2'), page: 'p3k', color: 'from-emerald-500/20 to-emerald-600/5' },
                  { icon: '📍', label: t('q3'), page: 'peta', color: 'from-orange-500/20 to-orange-600/5' },
                  { icon: '🚑', label: t('q4'), call: '119', color: 'from-red-500/20 to-red-600/5' },
                  { icon: '👮', label: t('q5'), call: '110', color: 'from-indigo-500/20 to-indigo-600/5' },
                  { icon: '⚓', label: t('q6'), call: '115', color: 'from-cyan-500/20 to-cyan-600/5' },
                ].map((item, i) => (
                  <motion.button 
                    key={i}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => item.page ? setActivePage(item.page as Page) : window.location.href = `tel:${item.call}`}
                    className={cn("bg-gradient-to-br border border-white/5 rounded-3xl p-4 flex flex-col items-center gap-3 transition-all shadow-lg", item.color)}
                  >
                    <div className="text-2xl drop-shadow-md">{item.icon}</div>
                    <div className="text-[10px] font-black text-[#7a9ab8] text-center leading-tight uppercase tracking-tight">{item.label}</div>
                  </motion.button>
                ))}
              </div>

              <div className="text-[11px] font-black text-[#3d6080] uppercase tracking-[0.2em] mb-4 px-1 font-mono flex items-center gap-2">
                <div className="w-8 h-[1px] bg-[#3d6080]/30" />
                {t('lbl_tips')}
              </div>
              <div className="bg-[#121f35]/50 border border-white/5 rounded-[2rem] overflow-hidden mb-10 shadow-xl">
                <div className="p-4 bg-white/5 flex items-center gap-3 border-b border-white/5">
                  <div className="p-2 bg-[#ffb830]/10 rounded-xl">
                    <AlertCircle className="w-4 h-4 text-[#ffb830]" />
                  </div>
                  <div className="text-xs font-black uppercase tracking-wider text-white">{t('tips_title')}</div>
                </div>
                <div className="divide-y divide-white/5">
                  {getDynamicTips().map((tip, i) => (
                    <motion.div 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      key={i} 
                      className="p-4 flex items-start gap-4 hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="w-2 h-2 rounded-full bg-[#00e5b0] mt-1.5 shrink-0 shadow-[0_0_8px_rgba(0,229,176,0.5)]" />
                      <div className="text-[12px] text-[#7a9ab8] leading-relaxed font-medium">{tip}</div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {deferredPrompt && (
                <button 
                  onClick={handleInstall}
                  className="w-full bg-gradient-to-r from-[#00e5b0] to-[#3d9bff] p-4 rounded-2xl text-white font-black text-sm shadow-xl shadow-emerald-900/20 mb-6 flex items-center justify-center gap-2"
                >
                  📥 {lang === 'id' ? 'INSTALL APLIKASI' : 'INSTALL APP'}
                </button>
              )}
            </motion.div>
          )}

          {/* PAGE: KONTAK */}
          {activePage === 'kontak' && (
            <motion.div key="kontak" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <div className="bg-[#ff3c3c]/10 border border-[#ff3c3c]/20 rounded-2xl p-4 flex items-center justify-between mb-6">
                <div>
                  <div className="text-2xl font-black text-[#ff3c3c] font-mono">112</div>
                  <div className="text-[10px] text-[#7a9ab8]">{t('emg_txt')}</div>
                </div>
                <button 
                  onClick={() => window.location.href = 'tel:112'}
                  className="bg-[#ff3c3c] text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg shadow-[#ff3c3c]/20"
                >📞 112</button>
              </div>

              <div className="space-y-6">
                {/* Medical */}
                <div>
                  <div className="text-[10px] font-bold text-[#3d6080] uppercase tracking-widest mb-2 px-1 font-mono">🏥 {t('lbl_med')}</div>
                  <div className="space-y-2">
                    {EMERGENCY_CONTACTS.filter(c => c.type === 'med').map((c, i) => (
                      <ContactCard key={i} c={c} t={t} lang={lang} />
                    ))}
                  </div>
                </div>

                {/* Police & Fire */}
                <div className="grid grid-cols-1 gap-6">
                  <div>
                    <div className="text-[10px] font-bold text-[#3d6080] uppercase tracking-widest mb-2 px-1 font-mono">👮 {t('lbl_pol')}</div>
                    <div className="space-y-2">
                      {EMERGENCY_CONTACTS.filter(c => c.type === 'pol').map((c, i) => (
                        <ContactCard key={i} c={c} t={t} lang={lang} />
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-[#3d6080] uppercase tracking-widest mb-2 px-1 font-mono">🚒 {t('lbl_fire')}</div>
                    <div className="space-y-2">
                      {EMERGENCY_CONTACTS.filter(c => c.type === 'fire').map((c, i) => (
                        <ContactCard key={i} c={c} t={t} lang={lang} />
                      ))}
                    </div>
                  </div>
                </div>

                {/* SAR */}
                <div>
                  <div className="text-[10px] font-bold text-[#3d6080] uppercase tracking-widest mb-2 px-1 font-mono">⚓ {t('lbl_sar')}</div>
                  <div className="space-y-2">
                    {EMERGENCY_CONTACTS.filter(c => c.type === 'sar').map((c, i) => (
                      <ContactCard key={i} c={c} t={t} lang={lang} />
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* PAGE: PETA */}
          {activePage === 'peta' && (
            <motion.div key="peta" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
              <div className="bg-[#121f35] border border-white/5 rounded-2xl overflow-hidden">
                <div className="p-4 bg-white/5 flex items-center justify-between">
                  <div className="text-xs font-bold">{lang === 'id' ? 'Peta Gili Trawangan' : 'Gili Trawangan Map'}</div>
                  <MapPin className="w-4 h-4 text-[#3d9bff]" />
                </div>
                <div className="aspect-square relative bg-[#0d1829] flex items-center justify-center overflow-hidden">
                  <Image 
                    src="https://picsum.photos/seed/gili-map/800/800" 
                    alt="Map Placeholder" 
                    fill
                    className="object-cover opacity-40"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
                    <div className="w-14 h-14 bg-[#ff3c3c] rounded-full flex items-center justify-center text-white shadow-[0_0_30px_rgba(255,60,60,0.5)] mb-4 animate-bounce">
                      <MapPin className="w-7 h-7" />
                    </div>
                    <div className="text-sm font-black mb-1 text-white uppercase tracking-tight">{lang === 'id' ? 'Lokasi Anda' : 'Your Location'}</div>
                    <div className="text-[10px] text-[#7a9ab8] font-mono mb-6 bg-black/40 px-3 py-1 rounded-full backdrop-blur-sm">{coords}</div>
                    <button 
                      onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${coords}`, '_blank')}
                      className="bg-[#3d9bff] text-white px-8 py-4 rounded-2xl text-xs font-black shadow-xl shadow-[#3d9bff]/30 active:scale-95 transition-transform"
                    >
                      {lang === 'id' ? 'BUKA GOOGLE MAPS' : 'OPEN GOOGLE MAPS'}
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#121f35] border border-white/5 rounded-2xl p-4">
                  <div className="text-[10px] text-[#3d6080] font-bold uppercase mb-2 tracking-widest">{lang === 'id' ? 'Titik Evakuasi' : 'Evacuation Point'}</div>
                  <div className="text-xs font-black text-white">{lang === 'id' ? 'Pelabuhan Utama' : 'Main Harbor'}</div>
                  <div className="text-[10px] text-[#7a9ab8] mt-1">{lang === 'id' ? 'Sisi Timur Pulau' : 'East Side of Island'}</div>
                </div>
                <div className="bg-[#121f35] border border-white/5 rounded-2xl p-4">
                  <div className="text-[10px] text-[#3d6080] font-bold uppercase mb-2 tracking-widest">{lang === 'id' ? 'Klinik Terdekat' : 'Nearest Clinic'}</div>
                  <div className="text-xs font-black text-white">{lang === 'id' ? 'Pusat Gili' : 'Gili Center'}</div>
                  <div className="text-[10px] text-[#7a9ab8] mt-1">{lang === 'id' ? 'Dekat Pasar Seni' : 'Near Art Market'}</div>
                </div>
              </div>
            </motion.div>
          )}

          {/* PAGE: P3K */}
          {activePage === 'p3k' && (
            <motion.div key="p3k" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <div className="space-y-3">
                {P3K_GUIDES.map((guide) => (
                  <div key={guide.id} className="bg-[#121f35] border border-white/5 rounded-2xl overflow-hidden">
                    <div className="p-4 bg-white/5 flex items-center gap-3">
                      <div className="text-2xl">{guide.icon}</div>
                      <div>
                        <div className="text-xs font-bold">{guide.title[lang]}</div>
                        <div className="flex gap-1 mt-1">
                          {guide.tags.map(tag => (
                            <span key={tag} className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-[#7a9ab8]">{tag}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="p-4 space-y-3">
                      {guide.steps.map((step, i) => (
                        <div key={step.id} className="flex gap-3">
                          <div className="w-5 h-5 rounded-full bg-[#18284a] border border-white/10 flex items-center justify-center text-[10px] font-bold shrink-0">{i+1}</div>
                          <div className="text-[11px] text-[#7a9ab8] leading-relaxed">{step.text[lang]}</div>
                        </div>
                      ))}
                      <div className="bg-[#ffb830]/5 border border-[#ffb830]/20 rounded-xl p-3 text-[10px] text-[#ffb830] flex gap-2">
                        <span>⚠️</span>
                        {guide.warning[lang]}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* PAGE: LOST & FOUND */}
          {activePage === 'lostfound' && (
            <motion.div key="lostfound" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-black text-white uppercase tracking-tight">{t('lf_title')}</h2>
                <div className="flex items-center gap-2">
                  {user && (
                    <button 
                      onClick={handleLogout}
                      className="text-[9px] font-black text-[#7a9ab8] uppercase tracking-widest bg-white/5 px-3 py-2 rounded-lg border border-white/5"
                    >
                      {t('lf_logout')}
                    </button>
                  )}
                  <button 
                    onClick={() => user ? setShowLfForm(true) : handleGoogleLogin()}
                    className="bg-[#3d9bff] text-white p-2 rounded-xl shadow-lg shadow-[#3d9bff]/20 active:scale-95 transition-all"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {!user && (
                <div className="bg-gradient-to-br from-[#3d9bff]/20 to-transparent border border-[#3d9bff]/30 rounded-3xl p-6 text-center mb-6">
                  <div className="w-12 h-12 bg-[#3d9bff]/20 rounded-2xl flex items-center justify-center text-[#3d9bff] mx-auto mb-4">
                    <Shield className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-black text-white uppercase tracking-tight mb-2">{t('lf_login_req')}</h3>
                  <button 
                    onClick={handleGoogleLogin}
                    className="bg-white text-[#080f1e] px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl flex items-center gap-2 mx-auto active:scale-95 transition-all"
                  >
                    <Image src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width={16} height={16} alt="Google" />
                    {t('lf_login_btn')}
                  </button>
                </div>
              )}

              {lfLoading ? (
                <div className="flex justify-center py-20">
                  <RefreshCw className="w-8 h-8 text-[#3d9bff] animate-spin" />
                </div>
              ) : lfItems.length === 0 ? (
                <div className="bg-[#121f35] border border-white/5 rounded-3xl p-12 text-center">
                  <div className="text-4xl mb-4 opacity-20">📦</div>
                  <div className="text-sm font-bold text-[#3d6080] uppercase tracking-widest">{t('lf_empty')}</div>
                </div>
              ) : (
                <div className="space-y-4">
                  {lfItems.map((item) => (
                    <motion.div 
                      layout
                      key={item.id}
                      className="bg-[#121f35] border border-white/5 rounded-2xl overflow-hidden relative group"
                    >
                      <div className={cn(
                        "absolute top-0 left-0 w-1 h-full",
                        item.type === 'lost' ? "bg-[#ff3c3c]" : "bg-[#00e5b0]"
                      )} />
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className={cn(
                            "text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest",
                            item.type === 'lost' ? "bg-[#ff3c3c]/10 text-[#ff3c3c]" : "bg-[#00e5b0]/10 text-[#00e5b0]"
                          )}>
                            {item.type === 'lost' ? t('lf_lost') : t('lf_found')}
                          </div>
                          {user?.uid === item.uid && (
                            <button 
                              onClick={() => deleteLfItem(item.id)}
                              className="p-1.5 text-[#ff3c3c] hover:bg-[#ff3c3c]/10 rounded-lg transition-all"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        <h3 className="text-sm font-black text-white mb-1 uppercase tracking-tight">{item.title}</h3>
                        <p className="text-[11px] text-[#7a9ab8] leading-relaxed mb-3">{item.description}</p>
                        
                        <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/5">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-3 h-3 text-[#3d9bff]" />
                            <span className="text-[10px] text-[#7a9ab8] font-bold truncate">{item.location}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MessageSquare className="w-3 h-3 text-[#00e5b0]" />
                            <span className="text-[10px] text-[#7a9ab8] font-bold truncate">{item.contact}</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Form Modal */}
              <AnimatePresence>
                {showLfForm && (
                  <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-end justify-center"
                    onClick={() => setShowLfForm(false)}
                  >
                    <motion.div 
                      initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                      className="bg-[#0d1829] w-full max-w-md rounded-t-[32px] border-t border-white/10 p-6 pb-12 overflow-y-auto max-h-[90vh]"
                      onClick={e => e.stopPropagation()}
                    >
                      <div className="w-10 h-1 bg-white/10 rounded-full mx-auto mb-6" />
                      <h2 className="text-xl font-black mb-6 text-white uppercase tracking-tight">{t('lf_form_title')}</h2>
                      
                      <form onSubmit={handleLfSubmit} className="space-y-4">
                        <div>
                          <label className="text-[10px] font-black text-[#3d6080] uppercase tracking-widest mb-2 block">{t('lf_type')}</label>
                          <div className="grid grid-cols-2 gap-2">
                            <button 
                              type="button"
                              onClick={() => setNewLf({...newLf, type: 'lost'})}
                              className={cn(
                                "py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border",
                                newLf.type === 'lost' ? "bg-[#ff3c3c] text-white border-[#ff3c3c]" : "bg-white/5 text-[#7a9ab8] border-white/5"
                              )}
                            >{t('lf_lost')}</button>
                            <button 
                              type="button"
                              onClick={() => setNewLf({...newLf, type: 'found'})}
                              className={cn(
                                "py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border",
                                newLf.type === 'found' ? "bg-[#00e5b0] text-white border-[#00e5b0]" : "bg-white/5 text-[#7a9ab8] border-white/5"
                              )}
                            >{t('lf_found')}</button>
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-black text-[#3d6080] uppercase tracking-widest mb-2 block">{t('lf_item_name')}</label>
                          <input 
                            required
                            value={newLf.title}
                            onChange={e => setNewLf({...newLf, title: e.target.value})}
                            className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-[#3d9bff] outline-none transition-all"
                            placeholder="e.g. iPhone 13, Sunglasses"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-black text-[#3d6080] uppercase tracking-widest mb-2 block">{t('lf_item_desc')}</label>
                          <textarea 
                            required
                            rows={3}
                            value={newLf.description}
                            onChange={e => setNewLf({...newLf, description: e.target.value})}
                            className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-[#3d9bff] outline-none transition-all resize-none"
                            placeholder="e.g. Blue case, cracked screen..."
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-black text-[#3d6080] uppercase tracking-widest mb-2 block">{t('lf_item_loc')}</label>
                          <input 
                            required
                            value={newLf.location}
                            onChange={e => setNewLf({...newLf, location: e.target.value})}
                            className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-[#3d9bff] outline-none transition-all"
                            placeholder="e.g. Near Night Market"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-black text-[#3d6080] uppercase tracking-widest mb-2 block">{t('lf_item_contact')}</label>
                          <input 
                            required
                            value={newLf.contact}
                            onChange={e => setNewLf({...newLf, contact: e.target.value})}
                            className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-[#3d9bff] outline-none transition-all"
                            placeholder="e.g. +62 812..."
                          />
                        </div>

                        <div className="pt-4">
                          <button 
                            type="submit"
                            className="w-full bg-gradient-to-r from-[#3d9bff] to-[#00e5b0] py-4 rounded-2xl text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-[#3d9bff]/20 active:scale-95 transition-all"
                          >
                            {t('lf_submit')}
                          </button>
                        </div>
                      </form>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* PAGE: INFO */}
          {activePage === 'info' && (
            <motion.div key="info" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
              <div>
                <div className="text-[10px] font-bold text-[#3d6080] uppercase tracking-widest mb-3 font-mono">📋 {t('lbl_hist')}</div>
                <div className="bg-[#121f35] border border-white/5 rounded-2xl p-4">
                  {history.length === 0 ? (
                    <div className="text-center py-4 text-[11px] text-[#3d6080] font-mono">{t('hist_empty')}</div>
                  ) : (
                    <div className="space-y-4">
                      {history.map((h, i) => (
                        <div key={i} className="flex gap-3 border-b border-white/5 pb-3 last:border-0 last:pb-0">
                          <div className="text-lg">🆘</div>
                          <div>
                            <div className="text-[11px] font-bold text-[#ff3c3c]">SOS SENT</div>
                            <div className="text-[9px] text-[#7a9ab8] font-mono mt-1">{h.time} • {h.coords}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <div className="text-[10px] font-bold text-[#3d6080] uppercase tracking-widest mb-3 font-mono">📜 {t('lbl_rules')}</div>
                <div className="grid grid-cols-1 gap-2">
                  {[t('rule1'), t('rule2'), t('rule3'), t('rule4')].map((rule, i) => (
                    <div key={i} className="bg-[#121f35] border border-white/5 rounded-xl p-3 text-[11px] text-[#7a9ab8] flex items-center gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#3d9bff]/40" />
                      {rule}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-[10px] font-bold text-[#3d6080] uppercase tracking-widest mb-3 font-mono">🔗 {t('lbl_links')}</div>
                <div className="space-y-2">
                  {[
                    { label: t('link1'), icon: '🚢', url: 'https://gilitransfers.com/fastboat-schedule' },
                    { label: t('link2'), icon: '🗺️', url: 'https://www.google.com/maps/search/Gili+Trawangan' },
                    { label: t('link3'), icon: '♻️', url: 'https://giliecotrust.com/' }
                  ].map((link, i) => (
                    <button 
                      key={i} 
                      onClick={() => window.open(link.url, '_blank')}
                      className="w-full bg-[#121f35] border border-white/5 rounded-xl p-3 text-[11px] text-[#7a9ab8] flex items-center justify-between hover:bg-white/10 hover:border-[#3d9bff]/30 transition-all active:scale-[0.98]"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-base">{link.icon}</span>
                        <span className="font-bold tracking-tight">{link.label}</span>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-[#3d9bff] opacity-60" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-white/5">
                <div className="text-[10px] font-bold text-[#3d6080] uppercase tracking-widest mb-4 font-mono">✨ {t('lbl_about')} GiliGuard</div>
                <div className="bg-[#121f35] border border-white/5 rounded-2xl p-5 space-y-4">
                  <p className="text-[11px] text-[#7a9ab8] leading-relaxed">
                    {t('about_desc')}
                  </p>
                  <div className="space-y-2">
                    {[t('about_feature1'), t('about_feature2'), t('about_feature3'), t('about_feature4')].map((f, i) => (
                      <div key={i} className="flex items-center gap-3 text-[10px] text-[#ddeeff] font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#00e5b0]" />
                        {f}
                      </div>
                    ))}
                  </div>
                  <div className="pt-4 border-t border-white/5 flex flex-col items-center gap-2">
                    <div className="text-[10px] text-[#3d6080] font-black uppercase tracking-widest">{t('about_dev')}</div>
                    <div className="text-[9px] text-[#7a9ab8]">{t('ver')}</div>
                    <div className="text-[9px] text-[#3d6080] italic">{t('mission')}</div>
                  </div>
                </div>
              </div>

              {/* Developer Section */}
              <div>
                <div className="text-[10px] font-bold text-[#3d6080] uppercase tracking-widest mb-3 font-mono">👨‍💻 {t('lbl_dev')}</div>
                <div className="bg-gradient-to-br from-[#121f35] to-[#0d1829] border border-white/5 rounded-2xl p-5 flex items-center gap-4 shadow-xl">
                  <div className="w-16 h-16 rounded-2xl bg-[#3d9bff]/10 border border-[#3d9bff]/20 flex items-center justify-center overflow-hidden">
                    <Image 
                      src="https://picsum.photos/seed/developer/200/200" 
                      alt="Developer" 
                      width={64} 
                      height={64}
                      className="object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-black text-white uppercase tracking-tight mb-0.5">{t('dev_name')}</div>
                    <div className="text-[10px] text-[#3d9bff] font-bold mb-2 uppercase tracking-wide">{t('dev_role')}</div>
                    <p className="text-[10px] text-[#7a9ab8] leading-tight italic">&quot;{t('dev_desc')}&quot;</p>
                  </div>
                </div>
              </div>

              {/* Legal Section */}
              <div>
                <div className="text-[10px] font-bold text-[#3d6080] uppercase tracking-widest mb-3 font-mono">⚖️ {t('lbl_legal')}</div>
                <div className="space-y-3">
                  <div className="bg-[#121f35] border border-white/5 rounded-2xl p-4">
                    <div className="text-[11px] font-black text-white uppercase tracking-wider mb-2 flex items-center gap-2">
                      <Shield className="w-3 h-3 text-[#ff3c3c]" />
                      {t('legal_terms_title')}
                    </div>
                    <p className="text-[10px] text-[#7a9ab8] leading-relaxed">
                      {t('legal_terms_desc')}
                    </p>
                  </div>
                  <div className="bg-[#121f35] border border-white/5 rounded-2xl p-4">
                    <div className="text-[11px] font-black text-white uppercase tracking-wider mb-2 flex items-center gap-2">
                      <CheckCircle2 className="w-3 h-3 text-[#00e5b0]" />
                      {t('legal_privacy_title')}
                    </div>
                    <p className="text-[10px] text-[#7a9ab8] leading-relaxed">
                      {t('legal_privacy_desc')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-4 text-center">
                <div className="mt-2 text-[8px] text-[#3d6080] uppercase tracking-widest opacity-40">{t('footer')}</div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <nav className="flex-shrink-0 bg-[#0d1829]/90 backdrop-blur-xl border-t border-white/5 px-4 py-1.5 pb-4 flex items-center justify-between z-50 fixed bottom-0 left-0 right-0 max-w-md mx-auto">
        {[
          { id: 'beranda', icon: Home, label: t('nav1') },
          { id: 'kontak', icon: Phone, label: t('nav2') },
          { id: 'p3k', icon: HeartPulse, label: t('nav3') },
          { id: 'peta', icon: MapPin, label: t('nav4') },
        ].map((item) => (
          <button 
            key={item.id}
            onClick={() => setActivePage(item.id as Page)}
            className="flex flex-col items-center gap-1 relative group flex-1"
          >
            <div className={cn(
              "p-2 rounded-xl transition-all duration-300 relative overflow-hidden",
              activePage === item.id 
                ? "bg-[#3d9bff] text-white shadow-lg shadow-[#3d9bff]/20 scale-105" 
                : "text-[#3d6080] hover:text-[#7a9ab8] hover:bg-white/5"
            )}>
              <item.icon className="w-5 h-5 relative z-10" />
              {activePage === item.id && (
                <motion.div 
                  layoutId="nav-glow"
                  className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent"
                />
              )}
            </div>
            <span className={cn(
              "text-[9px] font-black uppercase tracking-widest transition-all duration-300",
              activePage === item.id ? "text-white opacity-100" : "text-[#3d6080] opacity-60"
            )}>
              {item.label}
            </span>
          </button>
        ))}
      </nav>

      {/* SOS MODAL */}
      <AnimatePresence>
        {showSOSModal && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-end justify-center"
            onClick={() => !countdown && setShowSOSModal(false)}
          >
            <motion.div 
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              className="bg-[#0d1829] w-full max-w-md rounded-t-[32px] border-t border-white/10 p-6 pb-12"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-10 h-1 bg-white/10 rounded-full mx-auto mb-6" />
              <div className="text-4xl mb-4">🆘</div>
              <h2 className="text-2xl font-black mb-2 text-white uppercase tracking-tight">{t('m_title')}</h2>
              <p className="text-sm text-[#7a9ab8] leading-relaxed mb-8 font-medium">{t('m_desc')}</p>
              
              <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex items-center gap-4 mb-8 text-xs font-mono text-[#00e5b0] shadow-inner">
                <div className="p-2 bg-[#00e5b0]/10 rounded-xl">
                  <MapPin className="w-4 h-4" />
                </div>
                <div className="flex-1 truncate font-bold tracking-tight">{coords}</div>
              </div>

              {countdown !== null ? (
                <div className="mb-8">
                  <div className="text-center mb-4 text-xs font-black uppercase tracking-[0.2em] text-[#7a9ab8]">
                    {t('cd_text')}
                  </div>
                  <div className="flex items-center justify-center">
                    <div className="w-24 h-24 rounded-full border-4 border-[#ff3c3c]/20 flex items-center justify-center relative">
                      <motion.div 
                        initial={{ pathLength: 1 }}
                        animate={{ pathLength: 0 }}
                        transition={{ duration: 3, ease: "linear" }}
                        className="absolute inset-[-4px] rounded-full border-4 border-[#ff3c3c]"
                      />
                      <span className="text-5xl font-black text-[#ff3c3c] drop-shadow-[0_0_10px_rgba(255,60,60,0.5)]">{countdown}</span>
                    </div>
                  </div>
                  <div className="text-center mt-4 text-[10px] font-bold text-[#7a9ab8] uppercase tracking-widest">{t('cd_sec')}</div>
                  <button 
                    onClick={() => setCountdown(null)}
                    className="w-full mt-8 bg-white/5 hover:bg-white/10 text-[#ff3c3c] py-5 rounded-3xl text-xs font-black uppercase tracking-widest transition-all border border-[#ff3c3c]/20"
                  >{t('m_abort')}</button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => setShowSOSModal(false)}
                    className="bg-white/5 hover:bg-white/10 text-[#7a9ab8] py-5 rounded-3xl text-xs font-black uppercase tracking-widest transition-all border border-white/5"
                  >{t('m_cancel')}</button>
                  <button 
                    onClick={() => setCountdown(3)}
                    className="bg-gradient-to-br from-[#ff3c3c] to-[#c81414] text-white py-5 rounded-3xl text-xs font-black uppercase tracking-widest shadow-xl shadow-[#ff3c3c]/30 active:scale-95 transition-all"
                  >{t('m_call')}</button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SOS SENT OVERLAY */}
      <AnimatePresence>
        {isSOSSent && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 z-[200] flex flex-col items-center justify-center p-8 text-center"
          >
            <div className="text-6xl mb-6 animate-pulse">🚨</div>
            <h1 className="text-2xl font-black text-[#ff3c3c] mb-2 uppercase">{t('sent_title')}</h1>
            <div className="text-5xl font-black font-mono mb-6">{formatTime(sosTimer)}</div>
            <p className="text-sm text-[#7a9ab8] leading-relaxed mb-8">
              {lang === 'id' ? 'Sampaikan ke operator: ' : 'Tell operator: '}
              <strong>{lang === 'id' ? 'nama, lokasi, dan jenis darurat' : 'your name, location & type of emergency'}</strong>.
              <br /><br />
              GPS: <span className="font-mono text-[#ddeeff]">{coords}</span>
            </p>
            <button 
              onClick={() => setIsSOSSent(false)}
              className="bg-[#18284a] border border-white/10 px-8 py-4 rounded-2xl font-bold text-[#7a9ab8]"
            >{t('sent_close')}</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PWA INSTALL PROMPT */}
      <AnimatePresence>
        {showInstallPrompt && deferredPrompt && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-24 left-4 right-4 bg-[#1a2a44] border border-[#3d9bff]/30 rounded-3xl p-5 z-[80] shadow-2xl shadow-black/50"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-[#3d9bff]/20 rounded-2xl flex items-center justify-center text-[#3d9bff] border border-[#3d9bff]/20">
                <Shield className="w-6 h-6 fill-[#3d9bff]/10" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-black text-white uppercase tracking-tight mb-1">{t('pwa_title')}</h3>
                <p className="text-[11px] text-[#7a9ab8] leading-tight mb-4">{t('pwa_desc')}</p>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setShowInstallPrompt(false)}
                    className="flex-1 bg-white/5 hover:bg-white/10 text-[#7a9ab8] py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                  >{t('m_cancel')}</button>
                  <button 
                    onClick={() => {
                      handleInstall();
                      setShowInstallPrompt(false);
                    }}
                    className="flex-1 bg-[#3d9bff] text-white py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-[#3d9bff]/20 active:scale-95 transition-all"
                  >{t('pwa_btn')}</button>
                </div>
              </div>
              <button onClick={() => setShowInstallPrompt(false)} className="text-[#3d6080] hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
