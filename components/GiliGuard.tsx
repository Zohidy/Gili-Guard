'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { 
  Phone, Shield, HeartPulse, MapPin, AlertCircle, 
  Info, Navigation, Anchor, LifeBuoy, Home, 
  Settings, Cloud, Wind, Waves, RefreshCw, X, CheckCircle2,
  Droplets, Thermometer, Sun, CloudSun, CloudRain, 
  CloudLightning, CloudFog, CloudDrizzle, ExternalLink,
  Smartphone, Download, Search, Plus, MessageSquare, Trash2,
  Instagram, Linkedin, Github, Mail, Package, MoreHorizontal, Share2, LogOut, Clock,
  AlertTriangle, Users, Edit2, User as UserIcon, ChevronDown, ChevronLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import { GoogleGenAI, Type } from "@google/genai";
import { db, auth } from '@/lib/firebase';
import { 
  collection, addDoc, onSnapshot, query, 
  orderBy, serverTimestamp, deleteDoc, doc,
  Timestamp, updateDoc, arrayUnion, getDoc
} from 'firebase/firestore';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';

// --- Utility for Calling ---
const makeCall = (number: string) => {
  const cleanNumber = number.replace(/\s+/g, '');
  window.location.href = `tel:${cleanNumber}`;
};

// --- Types ---
type Lang = 'id' | 'en' | 'fr' | 'de' | 'es';
type Page = 'beranda' | 'kontak' | 'p3k' | 'peta' | 'info' | 'lostfound';

interface CommentItem {
  id: string;
  text: string;
  authorName: string;
  authorUid: string;
  createdAt: number;
}

interface LostFoundItem {
  id: string;
  type: 'lost' | 'found';
  title: string;
  description: string;
  location: string;
  contact: string;
  timeLost?: string;
  image?: string;
  createdAt: any;
  status: 'active' | 'resolved';
  uid: string;
  comments?: CommentItem[];
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
  htitle: { id: 'Gili Trawangan SOS', en: 'Gili Trawangan SOS', fr: 'SOS Gili Trawangan', de: 'Gili Trawangan SOS', es: 'SOS Gili Trawangan' },
  hsub: { id: 'Mencari lokasi GPS...', en: 'Finding GPS location...', fr: 'Recherche de la position GPS...', de: 'GPS-Standort wird gesucht...', es: 'Buscando ubicación GPS...' },
  sos_sub: { id: 'Tekan darurat', en: 'Tap for emergency', fr: 'Appuyez pour l\'urgence', de: 'Tippen für Notfall', es: 'Tocar para emergencia' },
  sos_hint: { id: 'Tekan → Konfirmasi → Langsung telepon 112', en: 'Tap → Confirm → Calls 112 directly', fr: 'Appuyer → Confirmer → Appelle le 112 directement', de: 'Tippen → Bestätigen → Ruft 112 direkt an', es: 'Tocar → Confirmar → Llama al 112 directamente' },
  lbl_quick: { id: 'Akses Cepat', en: 'Quick Access', fr: 'Accès Rapide', de: 'Schnellzugriff', es: 'Acceso Rápido' },
  q1: { id: 'Kontak Darurat', en: 'Emergency Contacts', fr: 'Contacts d\'Urgence', de: 'Notfallkontakte', es: 'Contactos de Emergencia' },
  q2: { id: 'Pertolongan Pertama', en: 'First Aid', fr: 'Premiers Secours', de: 'Erste Hilfe', es: 'Primeros Auxilios' },
  q3: { id: 'Fasilitas Terdekat', en: 'Nearest Facilities', fr: 'Installations Proches', de: 'Nächste Einrichtungen', es: 'Instalaciones Cercanas' },
  q4: { id: 'Ambulans 119', en: 'Ambulance 119', fr: 'Ambulance 119', de: 'Krankenwagen 119', es: 'Ambulancia 119' },
  q5: { id: 'Polisi 110', en: 'Police 110', fr: 'Police 110', de: 'Polizei 110', es: 'Policía 110' },
  q6: { id: 'SAR Laut 115', en: 'Sea Rescue 115', fr: 'Sauvetage en Mer 115', de: 'Seenotrettung 115', es: 'Rescate Marítimo 115' },
  lbl_tips: { id: 'Tips Keselamatan', en: 'Safety Tips', fr: 'Conseils de Sécurité', de: 'Sicherheitstipps', es: 'Consejos de Seguridad' },
  tips_title: { id: 'Kondisi Hari Ini', en: "Today's Conditions", fr: 'Conditions d\'Aujourd\'hui', de: 'Heutige Bedingungen', es: 'Condiciones de Hoy' },
  tip1: { id: 'Selalu pakai pelampung saat aktivitas laut', en: 'Always wear a life jacket during water activities', fr: 'Portez toujours un gilet de sauvetage lors des activités nautiques', de: 'Tragen Sie bei Wasseraktivitäten immer eine Schwimmweste', es: 'Use siempre chaleco salvavidas durante las actividades acuáticas' },
  tip2: { id: 'Tidak ada kendaraan bermotor – cidomo & sepeda saja', en: 'No motorised vehicles on Gili – cidomo & bicycle only', fr: 'Pas de véhicules motorisés sur Gili – cidomo et vélo uniquement', de: 'Keine motorisierten Fahrzeuge auf Gili – nur Cidomo und Fahrrad', es: 'No hay vehículos motorizados en Gili – solo cidomo y bicicleta' },
  tip3: { id: 'Minum air putih min. 2L/hari di cuaca panas ini', en: 'Drink minimum 2L of water per day in this heat', fr: 'Buvez au moins 2L d\'eau par jour par cette chaleur', de: 'Trinken Sie bei dieser Hitze mindestens 2 Liter Wasser pro Tag', es: 'Beba al menos 2 litros de agua al día con este calor' },
  tip4: { id: 'Snorkeling: selalu bersama teman, jangan sendiri', en: 'Snorkelling: always go with a buddy, never alone', fr: 'Snorkeling : allez-y toujours avec un ami, jamais seul', de: 'Schnorcheln: Gehen Sie immer mit einem Partner, nie allein', es: 'Snorkel: vaya siempre con un compañero, nunca solo' },
  tip5: { id: 'Evakuasi ke RS: cidomo → perahu → Pelabuhan Bangsal (±45 mnt)', en: 'Hospital evacuation: cidomo → boat → Bangsal Port (±45 min)', fr: 'Évacuation hôpital : cidomo → bateau → Port de Bangsal (±45 min)', de: 'Krankenhaus-Evakuierung: Cidomo → Boot → Hafen von Bangsal (±45 Min.)', es: 'Evacuación al hospital: cidomo → bote → Puerto de Bangsal (±45 min)' },
  tip6: { id: 'Waspada arus kuat di sisi timur pulau saat pasang', en: 'Beware of strong currents on the east side during high tide', fr: 'Attention aux courants forts sur le côté est à marée haute', de: 'Vorsicht vor starken Strömungen an der Ostseite bei Flut', es: 'Cuidado con las corrientes fuertes en el lado este durante la marea alta' },
  tip7: { id: 'Simpan nomor darurat di kontak cepat ponsel Anda', en: 'Save emergency numbers in your phone speed dial', fr: 'Enregistrez les numéros d\'urgence dans vos numéros abrégés', de: 'Notrufnummern in der Kurzwahl speichern', es: 'Guarde los números de emergencia en su marcación rápida' },
  tip8: { id: 'Jangan menyentuh atau menginjak terumbu karang', en: 'Do not touch or step on coral reefs', fr: 'Ne touchez pas et ne marchez pas sur les récifs coralliens', de: 'Korallenriffe nicht berühren oder betreten', es: 'No toque ni pise los arrecifes de coral' },
  tip9: { id: 'Gunakan tabir surya ramah lingkungan (reef-safe)', en: 'Use eco-friendly (reef-safe) sunscreen', fr: 'Utilisez une crème solaire écologique (respectueuse des récifs)', de: 'Umweltfreundliche (riff-sichere) Sonnencreme verwenden', es: 'Use protector solar ecológico (seguro para los arrecifes)' },
  tip10: { id: 'Hati-hati saat bersepeda di malam hari, jalanan gelap', en: 'Be careful when cycling at night, roads are dark', fr: 'Attention à vélo la nuit, les routes sont sombres', de: 'Vorsicht beim Radfahren in der Nacht, die Straßen sind dunkel', es: 'Tenga cuidado al andar en bicicleta por la noche, las calles están oscuras' },
  nav1: { id: 'Beranda', en: 'Home', fr: 'Accueil', de: 'Startseite', es: 'Inicio' },
  nav2: { id: 'Kontak', en: 'Contacts', fr: 'Contacts', de: 'Kontakte', es: 'Contactos' },
  nav3: { id: 'P3K', en: 'First Aid', fr: 'Premiers Secours', de: 'Erste Hilfe', es: 'Primeros Auxilios' },
  nav4: { id: 'Peta', en: 'Map', fr: 'Carte', de: 'Karte', es: 'Mapa' },
  nav5: { id: 'Info', en: 'Info', fr: 'Info', de: 'Info', es: 'Info' },
  nav6: { id: 'Hilang/Temu', en: 'Lost/Found', fr: 'Trouvé/Perdu', de: 'Fundbüro', es: 'Objetos Perdidos' },
  tab_info: { id: 'Informasi & Pengaturan', en: 'Info & Settings', fr: 'Info & Paramètres', de: 'Info & Einstellungen', es: 'Info y Ajustes' },
  lbl_welcome: { id: 'Selamat Datang di Gili T', en: 'Welcome to Gili T', fr: 'Bienvenue à Gili T', de: 'Willkommen auf Gili T', es: 'Bienvenido a Gili T' },
  lbl_cur_weather: { id: 'Cuaca Saat Ini', en: 'Current Weather', fr: 'Météo Actuelle', de: 'Aktuelles Wetter', es: 'Clima Actual' },
  lbl_recent_lf: { id: 'Laporan Terbaru', en: 'Recent Reports', fr: 'Rapports Récents', de: 'Aktuelle Berichte', es: 'Informes Recientes' },
  lf_title: { id: 'Barang Hilang & Temuan', en: 'Lost & Found Items', fr: 'Objets Perdus et Trouvés', de: 'Fundgegenstände', es: 'Objetos Perdidos y Encontrados' },
  lf_lost: { id: 'HILANG', en: 'LOST', fr: 'PERDU', de: 'VERLOREN', es: 'PERDIDO' },
  lf_found: { id: 'TEMUAN', en: 'FOUND', fr: 'TROUVÉ', de: 'GEFUNDEN', es: 'ENCONTRADO' },
  lf_report: { id: 'Lapor Barang', en: 'Report Item', fr: 'Signaler un objet', de: 'Gegenstand melden', es: 'Reportar objeto' },
  lf_empty: { id: 'Belum ada laporan barang', en: 'No item reports yet', fr: 'Aucun objet signalé pour le moment', de: 'Noch keine Meldungen', es: 'No hay informes de objetos aún' },
  lf_form_title: { id: 'Lapor Barang Baru', en: 'Report New Item', fr: 'Signaler un nouvel objet', de: 'Neuen Gegenstand melden', es: 'Reportar nuevo objeto' },
  lf_type: { id: 'Jenis Laporan', en: 'Report Type', fr: 'Type de rapport', de: 'Meldungsart', es: 'Tipo de informe' },
  lf_item_name: { id: 'Nama Barang', en: 'Item Name', fr: 'Nom de l\'objet', de: 'Name des Gegenstands', es: 'Nombre del objeto' },
  lf_item_desc: { id: 'Deskripsi (Warna, Ciri khas)', en: 'Description (Color, Features)', fr: 'Description (Couleur, Caractéristiques)', de: 'Beschreibung (Farbe, Merkmale)', es: 'Descripción (Color, Características)' },
  lf_item_loc: { id: 'Lokasi (Terakhir dilihat/ditemukan)', en: 'Location (Last seen/found)', fr: 'Lieu (Dernière vue/trouvé)', de: 'Ort (Zuletzt gesehen/gefunden)', es: 'Ubicación (Visto por última vez/encontrado)' },
  lf_item_contact: { id: 'Kontak (WA/Telepon)', en: 'Contact (WA/Phone)', fr: 'Contact (WA/Téléphone)', de: 'Kontakt (WA/Telefon)', es: 'Contacto (WA/Teléfono)' },
  lf_time: { id: 'Waktu Kejadian', en: 'Time of Incident', fr: 'Heure de l\'incident', de: 'Zeitpunkt des Vorfalls', es: 'Hora del incidente' },
  lf_image: { id: 'Foto Barang (Opsional)', en: 'Item Photo (Optional)', fr: 'Photo de l\'objet (Optionnel)', de: 'Foto des Gegenstands (Optional)', es: 'Foto del objeto (Opcional)' },
  lf_submit: { id: 'KIRIM LAPORAN', en: 'SUBMIT REPORT', fr: 'ENVOYER LE RAPPORT', de: 'BERICHT ABSENDEN', es: 'ENVIAR INFORME' },
  lf_success: { id: 'Laporan berhasil dikirim!', en: 'Report submitted successfully!', fr: 'Rapport envoyé avec succès !', de: 'Bericht erfolgreich gesendet!', es: '¡Informe enviado con éxito!' },
  lf_delete_confirm: { id: 'Hapus laporan ini?', en: 'Delete this report?', fr: 'Supprimer ce rapport ?', de: 'Diesen Bericht löschen?', es: '¿Eliminar este informe?' },
  lf_login_req: { id: 'Silakan masuk untuk melapor barang', en: 'Please sign in to report items', fr: 'Veuillez vous connecter pour signaler des objets', de: 'Bitte anmelden, um Gegenstände zu melden', es: 'Inicie sesión para reportar objetos' },
  lf_login_btn: { id: 'Masuk dengan Google', en: 'Sign in with Google', fr: 'Se connecter avec Google', de: 'Mit Google anmelden', es: 'Iniciar sesión con Google' },
  lf_logout: { id: 'Keluar', en: 'Sign Out', fr: 'Déconnexion', de: 'Abmelden', es: 'Cerrar sesión' },
  m_title: { id: 'Hubungi 112 Sekarang?', en: 'Call 112 Now?', fr: 'Appeler le 112 maintenant ?', de: 'Jetzt 112 anrufen?', es: '¿Llamar al 112 ahora?' },
  m_desc: { id: 'Aplikasi akan langsung menelepon 112 — darurat nasional terhubung ke polisi, ambulans, dan SAR.', en: 'The app will directly call 112 — the national emergency number connected to police, ambulance and SAR.', fr: 'L\'application appellera directement le 112 — le numéro d\'urgence national relié à la police, à l\'ambulance et au SAR.', de: 'Die App ruft direkt 112 an – den nationalen Notruf, der mit Polizei, Krankenwagen und SAR verbunden ist.', es: 'La aplicación llamará directamente al 112 — el número de emergencia nacional conectado con la policía, la ambulancia y el SAR.' },
  m_cancel: { id: 'Batal', en: 'Cancel', fr: 'Annuler', de: 'Abbrechen', es: 'Cancelar' },
  m_call: { id: '📞 TELEPON 112', en: '📞 CALL 112', fr: '📞 APPELER LE 112', de: '📞 112 ANRUFEN', es: '📞 LLAMAR AL 112' },
  m_abort: { id: '✕ Batalkan Panggilan', en: '✕ Cancel Call', fr: '✕ Annuler l\'appel', de: '✕ Anruf abbrechen', es: '✕ Cancelar llamada' },
  cd_text: { id: 'Menelepon dalam', en: 'Calling in', fr: 'Appel dans', de: 'Anruf in', es: 'Llamando en' },
  cd_sec: { id: 'detik...', en: 'seconds...', fr: 'secondes...', de: 'Sekunden...', es: 'segundos...' },
  sent_title: { id: 'MENELEPON 112...', en: 'CALLING 112...', fr: 'APPEL DU 112...', de: 'RUFE 112 AN...', es: 'LLAMANDO AL 112...' },
  sent_close: { id: 'Tutup', en: 'Close', fr: 'Fermer', de: 'Schließen', es: 'Cerrar' },
  hist_empty: { id: 'Belum ada aktivasi SOS', en: 'No SOS activations yet', fr: 'Aucune activation SOS pour le moment', de: 'Noch keine SOS-Aktivierungen', es: 'No hay activaciones de SOS aún' },
  emg_txt: { id: 'Darurat nasional · 24 jam · Semua darurat', en: 'National emergency · 24 hours · All emergencies', fr: 'Urgence nationale · 24h/24 · Toutes urgences', de: 'Nationaler Notruf · 24 Stunden · Alle Notfälle', es: 'Emergencia nacional · 24 horas · Todas las emergencias' },
  c1r: { id: 'Klinik di pulau · Terverifikasi', en: 'On-island clinic · Verified', fr: 'Clinique sur l\'île · Vérifiée', de: 'Klinik auf der Insel · Verifiziert', es: 'Clínica en la isla · Verificada' },
  c2r: { id: 'Klinik di pulau · Terverifikasi', en: 'On-island clinic · Verified', fr: 'Clinique sur l\'île · Vérifiée', de: 'Klinik auf der Insel · Verifiziert', es: 'Clínica en la isla · Verificada' },
  c3r: { id: 'RS terdekat · 45 mnt dengan speedboat', en: 'Nearest hospital · 45 min by speedboat', fr: 'Hôpital le plus proche · 45 min en speedboat', de: 'Nächstes Krankenhaus · 45 Min. mit dem Schnellboot', es: 'Hospital más cercano · 45 min en lancha rápida' },
  c4r: { id: 'Polisi di pulau · 24 jam', en: 'On-island police · 24 hours', fr: 'Police sur l\'île · 24h/24', de: 'Polizei auf der Insel · 24 Stunden', es: 'Policía en la isla · 24 horas' },
  c5r: { id: 'Tim SAR Mataram · Evakuasi laut', en: 'Mataram SAR Team · Sea evacuation', fr: 'Équipe SAR Mataram · Évacuation en mer', de: 'Mataram SAR Team · Meeresevakuierung', es: 'Equipo SAR Mataram · Evacuación marítima' },
  c6r: { id: 'Klinik di pulau · 24 jam', en: 'On-island clinic · 24 hours', fr: 'Clinique sur l\'île · 24h/24', de: 'Klinik auf der Insel · 24 Stunden', es: 'Clínica en la isla · 24 horas' },
  c7r: { id: 'Klinik di pulau · Terverifikasi', en: 'On-island clinic · Verified', fr: 'Clinique sur l\'île · Vérifiée', de: 'Klinik auf der Insel · Verifiziert', es: 'Clínica en la isla · Verificada' },
  c8r: { id: 'Damkar KLU · Respon cepat', en: 'North Lombok Fire Dept · Fast response', fr: 'Pompiers KLU · Réponse rapide', de: 'Feuerwehr KLU · Schnelle Reaktion', es: 'Bomberos KLU · Respuesta rápida' },
  c9r: { id: 'Unit Damkar Pulau · Respon lokal', en: 'Island Fire Unit · Local response', fr: 'Unité pompiers île · Réponse locale', de: 'Insel-Feuerwehr · Lokale Reaktion', es: 'Unidad de bomberos isla · Respuesta local' },
  lbl_med: { id: 'Kontak Medis', en: 'Medical Contacts', fr: 'Contacts Médicaux', de: 'Medizinische Kontakte', es: 'Contactos Médicos' },
  lbl_pol: { id: 'Polisi & Keamanan', en: 'Police & Security', fr: 'Police et Sécurité', de: 'Polizei & Sicherheit', es: 'Policía y Seguridad' },
  lbl_fire: { id: 'Pemadam Kebakaran', en: 'Fire Department', fr: 'Pompiers', de: 'Feuerwehr', es: 'Departamento de Bomberos' },
  lbl_sar: { id: 'SAR & Evakuasi', en: 'SAR & Evacuation', fr: 'SAR et Évacuation', de: 'SAR & Evakuierung', es: 'SAR y Evacuación' },
  lbl_hist: { id: 'Riwayat SOS', en: 'SOS History', fr: 'Historique SOS', de: 'SOS-Verlauf', es: 'Historial de SOS' },
  lbl_about: { id: 'Tentang', en: 'About', fr: 'À propos', de: 'Über uns', es: 'Acerca de' },
  lbl_rules: { id: 'Aturan Gili', en: 'Gili Rules', fr: 'Règles de Gili', de: 'Gili-Regeln', es: 'Reglas de Gili' },
  lbl_links: { id: 'Tautan Berguna', en: 'Useful Links', fr: 'Liens Utiles', de: 'Nützliche Links', es: 'Enlaces Útiles' },
  lbl_back: { id: 'Kembali', en: 'Back', fr: 'Retour', de: 'Zurück', es: 'Volver' },
  lbl_settings: { id: 'Pengaturan & Bahasa', en: 'Settings & Language', fr: 'Paramètres et Langue', de: 'Einstellungen & Sprache', es: 'Ajustes e Idioma' },
  lbl_peta: { id: 'Peta Pulau', en: 'Island Map', fr: 'Carte de l\'île', de: 'Inselkarte', es: 'Mapa de la Isla' },
  lbl_lang: { id: 'Pilih Bahasa', en: 'Select Language', fr: 'Choisir la langue', de: 'Sprache wählen', es: 'Seleccionar Idioma' },
  lbl_notif: { id: 'Notifikasi Push', en: 'Push Notifications', fr: 'Notifications Push', de: 'Push-Benachrichtigungen', es: 'Notificaciones Push' },
  lbl_loc: { id: 'Layanan Lokasi', en: 'Location Services', fr: 'Services de localisation', de: 'Standortdienste', es: 'Servicios de Ubicación' },
  lbl_data: { id: 'Penghemat Data', en: 'Data Saver', fr: 'Économiseur de données', de: 'Datensparmodus', es: 'Ahorro de Datos' },
  lbl_app_settings: { id: 'Pengaturan Aplikasi', en: 'App Settings', fr: 'Paramètres de l\'application', de: 'App-Einstellungen', es: 'Ajustes de la Aplicación' },
  rule1: { id: '🚫 Tanpa Kendaraan Bermotor', en: '🚫 No Motorized Vehicles', fr: '🚫 Pas de véhicules motorisés', de: '🚫 Keine motorisierten Fahrzeuge', es: '🚫 Sin vehículos motorizados' },
  rule2: { id: '👕 Berpakaian Sopan di Desa', en: '👕 Dress Modestly in Village', fr: '👕 Habillez-vous modestement au village', de: '👕 Angemessene Kleidung im Dorf', es: '👕 Vista con modestia en el pueblo' },
  rule3: { id: '🐢 Jangan Sentuh Penyu', en: '🐢 Do Not Touch Turtles', fr: '🐢 Ne touchez pas les tortues', de: '🐢 Schildkröten nicht berühren', es: '🐢 No toque las tortugas' },
  rule4: { id: '💧 Hemat Air Tawar', en: '💧 Conserve Fresh Water', fr: '💧 Économisez l\'eau douce', de: '💧 Süßwasser sparen', es: '💧 Ahorre agua dulce' },
  link1: { id: 'Jadwal Fastboat', en: 'Fastboat Schedule', fr: 'Horaires Fastboat', de: 'Schnellboot-Fahrplan', es: 'Horario de Lanchas Rápidas' },
  link2: { id: 'Peta Interaktif Gili', en: 'Gili Interactive Map', fr: 'Carte interactive de Gili', de: 'Interaktive Gili-Karte', es: 'Mapa Interactivo de Gili' },
  link3: { id: 'Laporan Sampah', en: 'Waste Report', fr: 'Rapport sur les déchets', de: 'Abfallbericht', es: 'Informe de Residuos' },
  link4: { id: 'Pajak Turis / Retribusi', en: 'Tourist Tax / Retribusi', fr: 'Taxe de séjour / Retribusi', de: 'Touristensteuer / Abgabe', es: 'Impuesto Turístico / Retribución' },
  link5: { id: 'Prakiraan Cuaca BMKG', en: 'BMKG Weather Forecast', fr: 'Prévisions météo BMKG', de: 'BMKG Wettervorhersage', es: 'Pronóstico del Tiempo BMKG' },
  link6: { id: 'Gili Eco Trust', en: 'Gili Eco Trust', fr: 'Gili Eco Trust', de: 'Gili Eco Trust', es: 'Gili Eco Trust' },
  link7: { id: 'Panduan Sewa Sepeda', en: 'Bicycle Rental Guide', fr: 'Guide de location de vélos', de: 'Fahrradverleih-Leitfaden', es: 'Guía de Alquiler de Bicicletas' },
  c10r: { id: 'Penyelamatan Hewan · Gili Trawangan', en: 'Animal Rescue · Gili Trawangan', fr: 'Sauvetage d\'animaux · Gili Trawangan', de: 'Tierrettung · Gili Trawangan', es: 'Rescate de Animales · Gili Trawangan' },
  lbl_animal: { id: 'Darurat Hewan', en: 'Animal Emergency', fr: 'Urgence animale', de: 'Tiernotfall', es: 'Emergencia Animal' },
  pwa_title: { id: 'Pasang GiliGuard', en: 'Install GiliGuard', fr: 'Installer GiliGuard', de: 'GiliGuard installieren', es: 'Instalar GiliGuard' },
  pwa_desc: { id: 'Akses cepat fitur darurat langsung dari layar utama Anda, bahkan saat offline.', en: 'Quick access to emergency features directly from your home screen, even offline.', fr: 'Accès rapide aux fonctions d\'urgence directement depuis votre écran d\'accueil, même hors ligne.', de: 'Schneller Zugriff auf Notruffunktionen direkt von Ihrem Startbildschirm aus, auch offline.', es: 'Acceso rápido a las funciones de emergencia directamente desde su pantalla de inicio, incluso sin conexión.' },
  pwa_btn: { id: 'Pasang Sekarang', en: 'Install Now', fr: 'Installer maintenant', de: 'Jetzt installieren', es: 'Instalar ahora' },
  ver: { id: 'Versi 2.2 – Ultra Comprehensive', en: 'Version 2.2 – Ultra Comprehensive', fr: 'Version 2.2 – Ultra complet', de: 'Version 2.2 – Ultra umfassend', es: 'Versión 2.2 – Ultra completo' },
  mission: { id: 'Dibuat untuk keselamatan Gili · Gratis selamanya', en: 'Built for Gili safety · Free forever', fr: 'Créé pour la sécurité de Gili · Gratuit pour toujours', de: 'Für die Sicherheit von Gili entwickelt · Für immer kostenlos', es: 'Creado para la seguridad de Gili · Gratis para siempre' },
  footer: { id: 'Untuk wisatawan & warga lokal · Gili Trawangan, NTB', en: 'Built for tourists & locals · Gili Trawangan, NTB', fr: 'Pour les touristes et les locaux · Gili Trawangan, NTB', de: 'Für Touristen & Einheimische · Gili Trawangan, NTB', es: 'Para turistas y locales · Gili Trawangan, NTB' },
  ai_btn: { id: 'Tanya AI Asisten', en: 'Ask AI Assistant', fr: 'Demander à l\'assistant IA', de: 'KI-Assistenten fragen', es: 'Preguntar al Asistente IA' },
  ai_title: { id: 'Asisten P3K AI', en: 'AI First Aid Assistant', fr: 'Assistant Premiers Secours IA', de: 'KI-Erste-Hilfe-Assistent', es: 'Asistente de Primeros Auxilios IA' },
  ai_placeholder: { id: 'Jelaskan gejala atau situasi darurat...', en: 'Describe symptoms or emergency...', fr: 'Décrivez les symptômes ou l\'urgence...', de: 'Symptome oder Notfall beschreiben...', es: 'Describa los síntomas o la emergencia...' },
  ai_disclaimer: { id: 'AI dapat membuat kesalahan. Selalu hubungi medis untuk darurat.', en: 'AI can make mistakes. Always call medical for emergencies.', fr: 'L\'IA peut faire des erreurs. Appelez toujours les secours pour les urgences.', de: 'KI kann Fehler machen. Rufen Sie im Notfall immer den medizinischen Dienst an.', es: 'La IA puede cometer errores. Siempre llame a emergencias médicas.' },
  ai_send: { id: 'Kirim', en: 'Send', fr: 'Envoyer', de: 'Senden', es: 'Enviar' },
  ai_back: { id: 'Kembali ke Panduan', en: 'Back to Guides', fr: 'Retour aux guides', de: 'Zurück zu den Anleitungen', es: 'Volver a las guías' },
  ai_err: { id: 'Maaf, terjadi kesalahan saat menghubungi AI.', en: 'Sorry, an error occurred while contacting AI.', fr: 'Désolé, une erreur s\'est produite lors de la connexion à l\'IA.', de: 'Entschuldigung, beim Kontaktieren der KI ist ein Fehler aufgetreten.', es: 'Lo siento, ocurrió un error al contactar a la IA.' },
  ai_prompt_hint: { id: 'Tanyakan apa saja tentang pertolongan pertama.', en: 'Ask anything about first aid.', fr: 'Posez n\'importe quelle question sur les premiers secours.', de: 'Fragen Sie alles über Erste Hilfe.', es: 'Pregunte cualquier cosa sobre primeros auxilios.' },
  
  // Weather Alerts
  w_alert_title: { id: 'WASPADA CUACA', en: 'WEATHER ALERT', fr: 'ALERTE MÉTÉO', de: 'WETTERWARNUNG', es: 'ALERTA METEOROLÓGICA' },
  w_storm_t: { id: 'Peringatan Badai/Hujan Lebat', en: 'Heavy Rain/Storm Alert', fr: 'Alerte Orage/Pluie Forte', de: 'Sturm-/Starkregenwarnung', es: 'Alerta de Tormenta/Lluvia Fuerte' },
  w_storm_d: { id: 'Cuaca buruk terdeteksi. Hindari aktivitas di luar ruangan dan perairan.', en: 'Severe weather detected. Avoid outdoor and water activities.', fr: 'Mauvais temps détecté. Évitez les activités de plein air et nautiques.', de: 'Schlechtes Wetter erkannt. Vermeiden Sie Aktivitäten im Freien und im Wasser.', es: 'Se detectó mal tiempo. Evite actividades al aire libre y acuáticas.' },
  w_wind_t: { id: 'Peringatan Angin Kencang', en: 'Strong Wind Alert', fr: 'Alerte Vent Fort', de: 'Starkwindwarnung', es: 'Alerta de Viento Fuerte' },
  w_wind_d: { id: 'Waspada pohon tumbang.', en: 'Beware of falling trees.', fr: 'Attention aux chutes d\'arbres.', de: 'Vorsicht vor umstürzenden Bäumen.', es: 'Cuidado con la caída de árboles.' },
  w_wave_t: { id: 'Peringatan Gelombang Tinggi', en: 'High Waves Alert', fr: 'Alerte Vagues Hautes', de: 'Hochwellenwarnung', es: 'Alerta de Olas Altas' },
  w_wave_d: { id: 'Sangat berbahaya untuk aktivitas laut.', en: 'Highly dangerous for sea activities.', fr: 'Très dangereux pour les activités nautiques.', de: 'Sehr gefährlich für Aktivitäten auf dem Meer.', es: 'Muy peligroso para actividades marítimas.' },
  w_feels: { id: 'TERASA', en: 'FEELS', fr: 'RESSENTI', de: 'GEFÜHLT', es: 'SENSACIÓN' },
  w_waves: { id: 'Ombak', en: 'Waves', fr: 'Vagues', de: 'Wellen', es: 'Olas' },
  w_high_tide: { id: 'Pasang Naik', en: 'High Tide', fr: 'Marée Haute', de: 'Flut', es: 'Marea Alta' },
  w_low_tide: { id: 'Surut', en: 'Low Tide', fr: 'Marée Basse', de: 'Ebbe', es: 'Marea Baja' },
  w_transition: { id: 'Transisi', en: 'Transition', fr: 'Transition', de: 'Übergang', es: 'Transición' },

  // Toasts & General UI
  t_img_size: { id: 'Ukuran gambar maksimal 5MB', en: 'Max image size is 5MB', fr: 'Taille d\'image max 5 Mo', de: 'Max. Bildgröße ist 5 MB', es: 'El tamaño máximo de imagen es 5 MB' },
  t_post_fail: { id: 'Gagal memposting', en: 'Failed to post', fr: 'Échec de la publication', de: 'Beitrag fehlgeschlagen', es: 'Error al publicar' },
  t_del_success: { id: 'Berhasil dihapus', en: 'Successfully deleted', fr: 'Supprimé avec succès', de: 'Erfolgreich gelöscht', es: 'Eliminado con éxito' },
  t_del_fail: { id: 'Gagal menghapus', en: 'Failed to delete', fr: 'Échec de la suppression', de: 'Löschen fehlgeschlagen', es: 'Error al eliminar' },
  t_login_comment: { id: 'Silakan masuk untuk berkomentar', en: 'Please sign in to comment', fr: 'Veuillez vous connecter pour commenter', de: 'Bitte anmelden, um zu kommentieren', es: 'Inicie sesión para comentar' },
  t_comment_success: { id: 'Komentar ditambahkan', en: 'Comment added', fr: 'Commentaire ajouté', de: 'Kommentar hinzugefügt', es: 'Comentario añadido' },
  t_comment_fail: { id: 'Gagal menambahkan komentar', en: 'Failed to add comment', fr: 'Échec de l\'ajout du commentaire', de: 'Kommentar hinzufügen fehlgeschlagen', es: 'Error al añadir comentario' },
  t_comment_update: { id: 'Komentar diperbarui', en: 'Comment updated', fr: 'Commentaire mis à jour', de: 'Kommentar aktualisiert', es: 'Comentario actualizado' },
  
  lbl_guest: { id: 'Tamu', en: 'Guest', fr: 'Invité', de: 'Gast', es: 'Invitado' },
  lbl_signin_full: { id: 'Masuk untuk fitur penuh', en: 'Sign in for full features', fr: 'Connectez-vous pour toutes les fonctionnalités', de: 'Anmelden für vollen Funktionsumfang', es: 'Inicie sesión para funciones completas' },
  lbl_search_p3k: { id: 'Cari panduan P3K...', en: 'Search first aid guides...', fr: 'Rechercher des guides de premiers secours...', de: 'Erste-Hilfe-Anleitungen suchen...', es: 'Buscar guías de primeros auxilios...' },
  lbl_search_lf: { id: 'Cari barang...', en: 'Search items...', fr: 'Rechercher des objets...', de: 'Gegenstände suchen...', es: 'Buscar objetos...' },
  lbl_all: { id: 'SEMUA', en: 'ALL', fr: 'TOUT', de: 'ALLE', es: 'TODO' },
  lbl_see_all: { id: 'Lihat Semua', en: 'See All', fr: 'Voir Tout', de: 'Alle ansehen', es: 'Ver Todo' },
  lbl_share_loc: { id: 'BAGIKAN LOKASI SAYA', en: 'SHARE MY LOCATION', fr: 'PARTAGER MA POSITION', de: 'MEINEN STANDORT TEILEN', es: 'COMPARTIR MI UBICACIÓN' },
  lbl_your_loc: { id: 'LOKASI ANDA', en: 'YOUR LOCATION', fr: 'VOTRE POSITION', de: 'IHR STANDORT', es: 'SU UBICACIÓN' },
  lbl_open_maps: { id: 'BUKA DI MAPS', en: 'OPEN IN MAPS', fr: 'OUVRIR DANS MAPS', de: 'IN MAPS ÖFFNEN', es: 'ABRIR EN MAPS' },
  lbl_evac_point: { id: 'TITIK EVAKUASI', en: 'EVACUATION POINT', fr: 'POINT D\'ÉVACUATION', de: 'EVAKUIERUNGSPUNKT', es: 'PUNTO DE EVACUACIÓN' },
  lbl_main_harbor: { id: 'Pelabuhan Utama', en: 'Main Harbor', fr: 'Port Principal', de: 'Hauptthafen', es: 'Puerto Principal' },
  lbl_east_side: { id: 'Sisi Timur Pulau', en: 'East Side of Island', fr: 'Côté Est de l\'île', de: 'Ostseite der Insel', es: 'Lado Este de la Isla' },
  lbl_near_art: { id: 'Dekat Pasar Seni', en: 'Near Art Market', fr: 'Près du marché d\'art', de: 'In der Nähe des Kunstmarktes', es: 'Cerca del Mercado de Arte' },
  lbl_gili_center: { id: 'Pusat Gili', en: 'Gili Center', fr: 'Centre de Gili', de: 'Gili-Zentrum', es: 'Centro de Gili' },
  lbl_write_comment: { id: 'Tulis komentar...', en: 'Write a comment...', fr: 'Écrire un commentaire...', de: 'Einen Kommentar schreiben...', es: 'Escribir un comentario...' },
  lbl_save: { id: 'SIMPAN', en: 'SAVE', fr: 'ENREGISTRER', de: 'SPEICHERN', es: 'GUARDAR' },
  lbl_close_details: { id: 'Tutup Detail', en: 'Close Details', fr: 'Fermer les détails', de: 'Details schließen', es: 'Cerrar Detalles' },
  lbl_view_details: { id: 'Lihat Detail & Komentar', en: 'View Details & Comments', fr: 'Voir détails et commentaires', de: 'Details & Kommentare ansehen', es: 'Ver Detalles y Comentarios' },
  lbl_delete_q: { id: 'Hapus Laporan?', en: 'Delete Report?', fr: 'Supprimer le rapport ?', de: 'Bericht löschen?', es: '¿Eliminar Informe?' },
  lbl_change_photo: { id: 'Ganti Foto', en: 'Change Photo', fr: 'Changer la photo', de: 'Foto ändern', es: 'Cambiar Foto' },
  lbl_choose_photo: { id: 'Pilih Foto', en: 'Choose Photo', fr: 'Choisir une photo', de: 'Foto auswählen', es: 'Elegir Foto' },
  lbl_moderating: { id: 'MEMODERASI...', en: 'MODERATING...', fr: 'MODÉRATION...', de: 'MODERIERUNG...', es: 'MODERANDO...' },
  lbl_dark_mode: { id: 'Mode Gelap', en: 'Dark Mode', fr: 'Mode Sombre', de: 'Dunkelmodus', es: 'Modo Oscuro' },
  lbl_support_dev: { id: 'DUKUNG PENGEMBANG', en: 'SUPPORT DEVELOPER', fr: 'SOUTENIR LE DÉVELOPPEUR', de: 'ENTWICKLER UNTERSTÜTZEN', es: 'APOYAR AL DESARROLLADOR' },
  lbl_tell_operator: { id: 'Sampaikan ke operator: ', en: 'Tell operator: ', fr: 'Dites à l\'opérateur : ', de: 'Sagen Sie dem Operator: ', es: 'Dígale al operador: ' },
  lbl_operator_hint: { id: 'Nama, Lokasi & Jenis Darurat', en: 'Name, Location & Emergency Type', fr: 'Nom, Lieu et Type d\'urgence', de: 'Name, Ort & Art des Notfalls', es: 'Nombre, Ubicación y Tipo de Emergencia' },
  lbl_sys_secure: { id: 'SISTEM AMAN', en: 'SYSTEM SECURE', fr: 'SYSTÈME SÉCURISÉ', de: 'SYSTEM SICHER', es: 'SISTEMA SEGURO' },
  lbl_nearby_med: { id: 'MEDIS TERDEKAT', en: 'NEARBY MEDICAL', fr: 'MÉDICAL PROCHE', de: 'MEDIZINISCH IN DER NÄHE', es: 'MÉDICO CERCANO' },
  lbl_quick_dial: { id: 'PANGGILAN CEPAT LOKAL', en: 'LOCAL QUICK DIAL', fr: 'APPEL RAPIDE LOCAL', de: 'LOKALE KURZWAHL', es: 'MARCACIÓN RÁPIDA LOCAL' },
  lbl_about_gili: { id: 'GILI TRAWANGAN MAP', en: 'GILI TRAWANGAN MAP', fr: 'CARTE DE GILI TRAWANGAN', de: 'KARTE VON GILI TRAWANGAN', es: 'MAPA DE GILI TRAWANGAN' },
  lbl_my_loc: { id: 'Lokasi Saya', en: 'My Location', fr: 'Ma position', de: 'Mein Standort', es: 'Mi Ubicación' },
  lbl_share_text: { id: 'Posisi saya saat ini di Gili Trawangan:', en: 'My current location in Gili Trawangan:', fr: 'Ma position actuelle à Gili Trawangan :', de: 'Mein aktueller Standort auf Gili Trawangan:', es: 'Mi ubicación actual en Gili Trawangan:' },
  t_rejected: { id: 'Ditolak', en: 'Rejected', fr: 'Refusé', de: 'Abgelehnt', es: 'Rechazado' },
  t_rejected_comment: { id: 'Komentar ditolak', en: 'Comment rejected', fr: 'Commentaire refusé', de: 'Kommentar abgelehnt', es: 'Comentario rechazado' },
  tip_rain_1: { id: '⚠️ Hujan: Jalanan licin, hati-hati bersepeda', en: '⚠️ Rain: Slippery roads, be careful cycling', fr: '⚠️ Pluie : Routes glissantes, soyez prudent à vélo', de: '⚠️ Regen: Rutschige Straßen, vorsichtig Rad fahren', es: '⚠️ Lluvia: Carreteras resbaladizas, cuidado al andar en bicicleta' },
  tip_rain_2: { id: '⚠️ Arus laut mungkin lebih kuat saat hujan', en: '⚠️ Sea currents may be stronger during rain', fr: '⚠️ Les courants marins peuvent être plus forts sous la pluie', de: '⚠️ Meeresströmungen können bei Regen stärker sein', es: '⚠️ Las corrientes marinas pueden ser más fuertes durante la lluvia' },
  tip_heat: { id: '🔥 Cuaca sangat panas! Minum air min. 3L/hari', en: '🔥 Extremely hot! Drink min. 3L of water/day', fr: '🔥 Très chaud ! Buvez au moins 3L d\'eau/jour', de: '🔥 Extrem heiß! Trinken Sie mindestens 3 Liter Wasser pro Tag', es: '🔥 ¡Extremadamente caluroso! Beba al menos 3 litros de agua al día' },
  tip_wave: { id: '🌊 Gelombang tinggi! Hindari snorkeling di area terbuka', en: '🌊 High waves! Avoid snorkeling in open areas', fr: '🌊 Vagues hautes ! Évitez le snorkeling en zone ouverte', de: '🌊 Hohe Wellen! Vermeiden Sie Schnorcheln in offenen Bereichen', es: '🌊 ¡Olas altas! Evite el snorkel en áreas abiertas' },
  tip_wind: { id: '💨 Angin kencang! Waspada pohon tumbang & debu', en: '💨 Strong wind! Beware of falling trees & dust', fr: '💨 Vent fort ! Attention aux chutes d\'arbres et à la poussière', de: '💨 Starker Wind! Vorsicht vor umstürzenden Bäumen und Staub', es: '💨 ¡Viento fuerte! Cuidado con la caída de árboles y el polvo' },
  ai_warning: { 
    id: 'Respons AI mungkin mengandung kesalahan. Selalu hubungi layanan medis (112) untuk keadaan darurat.', 
    en: 'AI responses may contain errors. Always contact medical services (112) for emergencies.',
    fr: 'Les réponses de l\'IA peuvent contenir des erreurs. Contactez toujours les services médicaux (112) en cas d\'urgence.',
    de: 'KI-Antworten können Fehler enthalten. Kontaktieren Sie in Notfällen immer den medizinischen Dienst (112).',
    es: 'Las respuestas de la IA pueden contener errores. Póngase siempre en contacto con los servicios médicos (112) en caso de emergencia.'
  },
  about_desc: { 
    id: 'GiliGuard adalah aplikasi pendamping keselamatan digital yang dirancang khusus untuk wisatawan dan warga lokal di Gili Trawangan. Fokus utama kami adalah mempercepat respon darurat di pulau yang tidak memiliki kendaraan bermotor ini.', 
    en: 'GiliGuard is a digital safety companion app designed specifically for tourists and locals on Gili Trawangan. Our main focus is to accelerate emergency response on this motor-free island.',
    fr: 'GiliGuard est une application compagnon de sécurité numérique conçue spécifiquement pour les touristes et les habitants de Gili Trawangan. Notre objectif principal est d\'accélérer l\'intervention d\'urgence sur cette île sans moteur.',
    de: 'GiliGuard ist eine digitale Sicherheitsbegleiter-App, die speziell für Touristen und Einheimische auf Gili Trawangan entwickelt wurde. Unser Hauptaugenmerk liegt auf der Beschleunigung der Notfallreaktion auf dieser motorfreien Insel.',
    es: 'GiliGuard es una aplicación complementaria de seguridad digital diseñada específicamente para turistas y locales en Gili Trawangan. Nuestro enfoque principal es acelerar la respuesta de emergencia en esta isla sin vehículos motorizados.'
  },
  about_feature1: { id: 'Akses instan ke nomor darurat 112.', en: 'Instant access to 112 emergency numbers.', fr: 'Accès instantané aux numéros d\'urgence 112.', de: 'Sofortiger Zugriff auf die Notrufnummer 112.', es: 'Acceso instantáneo a los números de emergencia 112.' },
  about_feature2: { id: 'Panduan P3K untuk situasi kritis di laut & darat.', en: 'First aid guides for critical sea & land situations.', fr: 'Guides de premiers secours pour les situations critiques en mer et sur terre.', de: 'Erste-Hilfe-Anleitungen für kritische Situationen auf See und an Land.', es: 'Guías de primeros auxilios para situaciones críticas en el mar y en tierra.' },
  about_feature3: { id: 'Peta fasilitas medis & keamanan terdekat.', en: 'Map of nearest medical & security facilities.', fr: 'Carte des installations médicales et de sécurité les plus proches.', de: 'Karte der nächstgelegenen medizinischen und Sicherheitseinrichtungen.', es: 'Mapa de las instalaciones médicas y de seguridad más cercanas.' },
  about_feature4: { id: 'Laporan barang hilang/temu berbasis komunitas.', en: 'Community-based lost & found reporting.', fr: 'Signalement d\'objets perdus et trouvés basé sur la communauté.', de: 'Community-basiertes Fundbüro-Reporting.', es: 'Informes de objetos perdidos y encontrados basados en la comunidad.' },
  about_dev: { id: 'Dikembangkan dengan ❤️ untuk Gili Trawangan.', en: 'Developed with ❤️ for Gili Trawangan.', fr: 'Développé avec ❤️ pour Gili Trawangan.', de: 'Mit ❤️ für Gili Trawangan entwickelt.', es: 'Desarrollado con ❤️ para Gili Trawangan.' },
  lbl_legal: { id: 'Legal & Privasi', en: 'Legal & Privacy', fr: 'Légal et Confidentialité', de: 'Rechtliches & Datenschutz', es: 'Legal y Privacidad' },
  lbl_dev: { id: 'Profil Pengembang', en: 'Developer Profile', fr: 'Profil du développeur', de: 'Entwicklerprofil', es: 'Perfil del Desarrollador' },
  lbl_feedback: { id: 'Kirim Masukan', en: 'Send Feedback', fr: 'Envoyer des commentaires', de: 'Feedback senden', es: 'Enviar Comentarios' },
  feedback_desc: { id: 'Bantu kami meningkatkan GiliGuard. Kirimkan saran, laporan bug, atau ide fitur baru langsung ke pengembang.', en: 'Help us improve GiliGuard. Send suggestions, bug reports, or new feature ideas directly to the developer.', fr: 'Aidez-nous à améliorer GiliGuard. Envoyez des suggestions, des rapports de bogues ou de nouvelles idées de fonctionnalités directement au développeur.', de: 'Helfen Sie uns, GiliGuard zu verbessern. Senden Sie Vorschläge, Fehlerberichte oder neue Funktionsideen direkt an den Entwickler.', es: 'Ayúdenos a mejorar GiliGuard. Envíe sugerencias, informes de errores o nuevas ideas de funciones directamente al desarrollador.' },
  feedback_btn: { id: 'Kirim via Email', en: 'Send via Email', fr: 'Envoyer par e-mail', de: 'Per E-Mail senden', es: 'Enviar por Correo' },
  feedback_btn_wa: { id: 'Kirim via WhatsApp', en: 'Send via WhatsApp', fr: 'Envoyer via WhatsApp', de: 'Per WhatsApp senden', es: 'Enviar por WhatsApp' },
  dev_name: { id: 'Zohidy', en: 'Zohidy', fr: 'Zohidy', de: 'Zohidy', es: 'Zohidy' },
  dev_role: { id: 'Full-stack Developer & Gili Enthusiast', en: 'Full-stack Developer & Gili Enthusiast', fr: 'Développeur Full-stack et passionné de Gili', de: 'Full-Stack-Entwickler & Gili-Enthusiast', es: 'Desarrollador Full-stack y entusiasta de Gili' },
  dev_desc: { id: 'Membangun solusi digital untuk dampak sosial dan keselamatan komunitas.', en: 'Building digital solutions for social impact and community safety.', fr: 'Construire des solutions numériques pour l\'impact social et la sécurité communautaire.', de: 'Digitale Lösungen für soziale Auswirkungen und Gemeinschaftssicherheit entwickeln.', es: 'Construyendo soluciones digitales para el impacto social y la seguridad de la comunidad.' },
  legal_terms_title: { id: 'Syarat & Ketentuan', en: 'Terms of Use', fr: 'Conditions d\'utilisation', de: 'Nutzungsbedingungen', es: 'Términos de Uso' },
  legal_terms_desc: { id: 'GiliGuard adalah alat bantu informasi. Dalam keadaan darurat nyata, selalu prioritaskan instruksi dari petugas berwenang di lapangan.', en: 'GiliGuard is an information tool. In real emergencies, always prioritize instructions from authorities on the ground.', fr: 'GiliGuard est un outil d\'information. En cas d\'urgence réelle, donnez toujours la priorité aux instructions des autorités sur le terrain.', de: 'GiliGuard ist ein Informationstool. In echten Notfällen haben die Anweisungen der Behörden vor Ort immer Vorrang.', es: 'GiliGuard es una herramienta de información. En emergencias reales, siempre priorice las instrucciones de las autoridades en el terreno.' },
  legal_privacy_title: { id: 'Kebijakan Privasi', en: 'Privacy Policy', fr: 'Politique de confidentialité', de: 'Datenschutzerklärung', es: 'Política de Privacidad' },
  legal_privacy_desc: { id: 'Kami menghargai privasi Anda. Data login Google hanya digunakan untuk identifikasi laporan Lost & Found. Lokasi GPS Anda hanya diproses secara lokal untuk membantu Anda memberikan informasi ke operator 112.', en: 'We value your privacy. Google login data is only used for Lost & Found identification. Your GPS location is processed locally to help you provide info to 112 operators.', fr: 'Nous respectons votre vie privée. Les données de connexion Google ne sont utilisées que pour l\'identification des rapports Lost & Found. Votre position GPS n\'est traitée que localement pour vous aider à fournir des informations aux opérateurs du 112.', de: 'Wir schätzen Ihre Privatsphäre. Google-Login-Daten werden nur zur Identifizierung von Fundbüro-Meldungen verwendet. Ihr GPS-Standort wird nur lokal verarbeitet, um Ihnen bei der Übermittlung von Informationen an die 112-Zentrale zu helfen.', es: 'Valoramos su privacidad. Los datos de inicio de sesión de Google solo se usan para la identificación de informes de objetos perdidos y encontrados. Su ubicación GPS solo se procesa localmente para ayudarlo a proporcionar información a los operadores del 112.' },
  dev_contact: { id: 'Hubungi Saya', en: 'Contact Me', fr: 'Contactez-moi', de: 'Kontaktieren Sie mich', es: 'Contáctame' },
  disclaimer: { id: 'Aplikasi ini masih dalam tahap pengembangan. Mohon maklum jika ada kendala.', en: 'This app is still under development. Please excuse any issues.', fr: 'Cette application est encore en développement. Veuillez nous excuser pour tout problème.', de: 'Diese App befindet sich noch in der Entwicklung. Bitte entschuldigen Sie etwaige Probleme.', es: 'Esta aplicación aún está en desarrollo. Por favor, disculpe cualquier inconveniente.' },
  lbl_how_to_use: { id: 'Cara Penggunaan', en: 'How to Use', fr: 'Comment utiliser', de: 'Bedienungsanleitung', es: 'Cómo usar' },
  how_to_use_content: {
    id: `
### 🛡️ Fitur SOS (Darurat)
1. **Tekan Tombol SOS Merah**: Di halaman beranda, tekan tombol SOS besar.
2. **Konfirmasi**: Akan muncul hitung mundur 3 detik. Anda bisa membatalkan jika tidak sengaja.
3. **Panggilan Otomatis**: Setelah 3 detik, aplikasi akan membuka menu telepon ke nomor **112** (Darurat Nasional).

### 📞 Kontak Darurat
- Buka menu **Kontak** untuk melihat daftar klinik, polisi, dan tim SAR di Gili Trawangan.
- Tekan ikon telepon pada daftar untuk langsung melakukan panggilan.

### 📦 Hilang & Temu (Lost & Found)
- **Melihat Laporan**: Buka menu **Hilang/Temu** untuk melihat barang yang dilaporkan hilang atau ditemukan.
- **Melapor**: Tekan tombol **Lapor Barang**. Anda perlu masuk dengan akun Google untuk mengirim laporan.
- **Interaksi**: Anda bisa memberikan komentar pada setiap laporan untuk membantu koordinasi.

### 🏥 Panduan P3K & AI
- Menu **P3K** berisi panduan langkah-demi-langkah untuk situasi darurat umum.
- Gunakan **Asisten AI** di bagian bawah menu P3K untuk bertanya tentang penanganan medis pertama secara interaktif.
`,
    en: `
### 🛡️ SOS Feature (Emergency)
1. **Press Red SOS Button**: On the home page, press the large SOS button.
2. **Confirmation**: A 3-second countdown will appear. You can cancel if pressed accidentally.
3. **Auto Call**: After 3 seconds, the app will open the dialer to **112** (National Emergency).

### 📞 Emergency Contacts
- Open the **Contacts** menu to see a list of clinics, police, and SAR teams in Gili Trawangan.
- Tap the phone icon on the list to make a call directly.

### 📦 Lost & Found
- **View Reports**: Open the **Lost/Found** menu to see items reported lost or found.
- **Report**: Press the **Report Item** button. You need to sign in with a Google account to submit a report.
- **Interaction**: You can comment on each report to help with coordination.

### 🏥 First Aid Guides & AI
- The **First Aid** menu contains step-by-step guides for common emergency situations.
- Use the **AI Assistant** at the bottom of the First Aid menu to ask about medical first aid interactively.
`,
    fr: `
### 🛡️ Fonction SOS (Urgence)
1. **Appuyez sur le bouton SOS rouge** : Sur la page d'accueil, appuyez sur le grand bouton SOS.
2. **Confirmation** : Un compte à rebours de 3 secondes apparaîtra. Vous pouvez annuler en cas d'appui accidentel.
3. **Appel automatique** : Après 3 secondes, l'application ouvrira le composeur vers le **112** (Urgence Nationale).

### 📞 Contacts d'Urgence
- Ouvrez le menu **Contacts** pour voir la liste des cliniques, de la police et des équipes SAR à Gili Trawangan.
- Appuyez sur l'icône du téléphone dans la liste pour passer un appel directement.

### 📦 Objets Perdus et Trouvés
- **Voir les rapports** : Ouvrez le menu **Trouvé/Perdu** pour voir les objets signalés comme perdus ou trouvés.
- **Signaler** : Appuyez sur le bouton **Signaler un objet**. Vous devez vous connecter avec un compte Google pour soumettre un rapport.
- **Interaction** : Vous pouvez commenter chaque rapport pour aider à la coordination.

### 🏥 Guides de Premiers Secours et IA
- Le menu **Premiers Secours** contient des guides étape par étape pour les situations d'urgence courantes.
- Utilisez l'**Assistant IA** en bas du menu Premiers Secours pour poser des questions sur les premiers secours médicaux de manière interactive.
`,
    de: `
### 🛡️ SOS-Funktion (Notfall)
1. **Roten SOS-Knopf drücken**: Drücken Sie auf der Startseite den großen SOS-Knopf.
2. **Bestätigung**: Ein 3-Sekunden-Countdown erscheint. Sie können abbrechen, wenn Sie versehentlich gedrückt haben.
3. **Automatischer Anruf**: Nach 3 Sekunden öffnet die App die Wähltastatur für die **112** (Nationaler Notruf).

### 📞 Notfallkontakte
- Öffnen Sie das Menü **Kontakte**, um eine Liste der Kliniken, der Polizei und der SAR-Teams auf Gili Trawangan zu sehen.
- Tippen Sie auf das Telefonsymbol in der Liste, um direkt anzurufen.

### 📦 Fundbüro (Lost & Found)
- **Berichte ansehen**: Öffnen Sie das Menü **Fundbüro**, um als verloren oder gefunden gemeldete Gegenstände zu sehen.
- **Melden**: Drücken Sie die Schaltfläche **Gegenstand melden**. Sie müssen sich mit einem Google-Konto anmelden, um einen Bericht einzureichen.
- **Interaktion**: Sie können jeden Bericht kommentieren, um bei der Koordinierung zu helfen.

### 🏥 Erste-Hilfe-Anleitungen & KI
- Das Menü **Erste Hilfe** enthält Schritt-für-Schritt-Anleitungen für häufige Notfallsituationen.
- Nutzen Sie den **KI-Assistenten** am Ende des Erste-Hilfe-Menüs, um interaktiv Fragen zur medizinischen Ersten Hilfe zu stellen.
`,
    es: `
### 🛡️ Función SOS (Emergencia)
1. **Presione el botón SOS rojo**: En la página de inicio, presione el botón SOS grande.
2. **Confirmación**: Aparecerá una cuenta regresiva de 3 segundos. Puede cancelar si lo presionó accidentalmente.
3. **Llamada automática**: Después de 3 segundos, la aplicación abrirá el marcador al **112** (Emergencia Nacional).

### 📞 Contactos de Emergencia
- Abra el menú **Contactos** para ver una lista de clínicas, policía y equipos SAR en Gili Trawangan.
- Toque el icono del teléfono en la lista para realizar una llamada directamente.

### 📦 Objetos Perdidos y Encontrados
- **Ver informes**: Abra el menú **Objetos Perdidos** para ver los artículos reportados como perdidos o encontrados.
- **Reportar**: Presione el botón **Reportar objeto**. Debe iniciar sesión con una cuenta de Google para enviar un informe.
- **Interacción**: Puede comentar en cada informe para ayudar con la coordinación.

### 🏥 Guías de Primeros Auxilios e IA
- El menú **Primeros Auxilios** contiene guías paso a paso para situaciones de emergencia comunes.
- Use el **Asistente IA** en la parte inferior del menú de Primeros Auxilios para preguntar sobre primeros auxilios médicos de forma interactiva.
`
  },
  onb_title: { id: 'Selamat Datang di GiliGuard', en: 'Welcome to GiliGuard', fr: 'Bienvenue sur GiliGuard', de: 'Willkommen bei GiliGuard', es: 'Bienvenido a GiliGuard' },
  onb_desc: { id: 'Pendamping keselamatan digital Anda di Gili Trawangan. Mari kita lihat cara kerjanya.', en: 'Your digital safety companion in Gili Trawangan. Let\'s see how it works.', fr: 'Votre compagnon de sécurité numérique à Gili Trawangan. Voyons comment cela fonctionne.', de: 'Ihr digitaler Sicherheitsbegleiter auf Gili Trawangan. Schauen wir uns an, wie es funktioniert.', es: 'Su compañero de seguridad digital en Gili Trawangan. Veamos cómo funciona.' },
  onb_next: { id: 'Lanjut', en: 'Next', fr: 'Suivant', de: 'Weiter', es: 'Siguiente' },
  onb_skip: { id: 'Lewati', en: 'Skip', fr: 'Passer', de: 'Überspringen', es: 'Saltar' },
  onb_start: { id: 'Mulai Sekarang', en: 'Get Started', fr: 'Commencer', de: 'Jetzt loslegen', es: 'Empezar ahora' },
  onb_step1_title: { id: 'Tombol SOS Cepat', en: 'Quick SOS Button', fr: 'Bouton SOS rapide', de: 'Schneller SOS-Knopf', es: 'Botón SOS Rápido' },
  onb_step1_desc: { id: 'Tekan tombol SOS merah untuk bantuan darurat instan ke 112.', en: 'Press the red SOS button for instant emergency assistance to 112.', fr: 'Appuyez sur le bouton SOS rouge pour une assistance d\'urgence instantanée au 112.', de: 'Drücken Sie den roten SOS-Knopf für sofortige Notfallhilfe unter 112.', es: 'Presione el botón SOS rojo para asistencia de emergencia instantánea al 112.' },
  onb_step2_title: { id: 'Kontak & Medis', en: 'Contacts & Medical', fr: 'Contacts et Médical', de: 'Kontakte & Medizin', es: 'Contactos y Médico' },
  onb_step2_desc: { id: 'Temukan klinik, polisi, dan panduan P3K dengan mudah.', en: 'Easily find clinics, police, and first aid guides.', fr: 'Trouvez facilement des cliniques, la police et des guides de premiers secours.', de: 'Finden Sie ganz einfach Kliniken, Polizei und Erste-Hilfe-Anleitungen.', es: 'Encuentre fácilmente clínicas, policía y guías de primeros auxilios.' },
  onb_step3_title: { id: 'Lost & Found', en: 'Lost & Found', fr: 'Trouvé et Perdu', de: 'Fundbüro', es: 'Objetos Perdidos y Encontrados' },
  onb_step3_desc: { id: 'Laporkan atau cari barang hilang di sekitar pulau.', en: 'Report or search for lost items around the island.', fr: 'Signalez ou recherchez des objets perdus sur l\'île.', de: 'Melden oder suchen Sie nach verlorenen Gegenständen auf der Insel.', es: 'Reporte o busque objetos perdidos por la isla.' },
  
  // P3K Categories
  cat_all: { id: 'Semua', en: 'All', fr: 'Tout', de: 'Alle', es: 'Todo' },
  cat_kritis: { id: 'Kritis', en: 'Critical', fr: 'Critique', de: 'Kritisch', es: 'Crítico' },
  cat_laut: { id: 'Laut', en: 'Sea', fr: 'Mer', de: 'Meer', es: 'Mar' },
  cat_sedang: { id: 'Sedang', en: 'Moderate', fr: 'Modéré', de: 'Moderat', es: 'Moderado' },
  cat_serius: { id: 'Serius', en: 'Serious', fr: 'Sérieux', de: 'Ernsthaft', es: 'Serio' },
  cat_darat: { id: 'Darat', en: 'Land', fr: 'Terre', de: 'Land', es: 'Tierra' },
  cat_umum: { id: 'Umum', en: 'General', fr: 'Général', de: 'Allgemein', es: 'General' },
  cat_hewan: { id: 'Hewan', en: 'Animal', fr: 'Animal', de: 'Tier', es: 'Animal' },
  cat_luni: { id: 'LUNI', en: 'LUNI', fr: 'LUNI', de: 'LUNI', es: 'LUNI' },
};

const P3K_GUIDES = [
  {
    id: 'p1',
    icon: '🌊',
    title: { id: 'Tenggelam / Hampir tenggelam', en: 'Drowning / Near-drowning', fr: 'Noyade / Quasi-noyade', de: 'Ertrinken / Beinahe-Ertrinken', es: 'Ahogamiento / Casi ahogamiento' },
    tags: ['KRITIS', 'LAUT'],
    steps: [
      { id: 's1', text: { id: 'Pastikan kamu aman dahulu. Jangan terjun — gunakan pelampung, tali, atau benda terapung.', en: "Make sure YOU are safe first. Don't jump in — use a life ring, rope, or floating object.", fr: "Assurez-vous d'abord d'être en sécurité. Ne sautez pas — utilisez une bouée, une corde ou un objet flottant.", de: "Stellen Sie sicher, dass SIE zuerst sicher sind. Springen Sie nicht hinein — verwenden Sie einen Rettungsring, ein Seil oder einen schwimmenden Gegenstand.", es: "Asegúrese de estar seguro PRIMERO. No salte — use un salvavidas, una cuerda o un objeto flotante." } },
      { id: 's2', text: { id: 'Keluarkan korban dari air. Posisi terlentang di permukaan datar. Minta bantuan serentak.', en: 'Pull victim out of water. Lay flat on their back. Call for help simultaneously.', fr: "Sortez la victime de l'eau. Allongez-la sur le dos sur une surface plane. Appelez à l'aide simultanément.", de: "Holen Sie das Opfer aus dem Wasser. Legen Sie es flach auf den Rücken. Rufen Sie gleichzeitig um Hilfe.", es: "Saque a la víctima del agua. Acuéstela boca arriba sobre una superficie plana. Pida ayuda simultáneamente." } },
      { id: 's3', text: { id: 'Cek napas. Jika tidak bernapas: CPR — 30 tekanan dada + 2 napas buatan.', en: 'Check breathing. If not breathing: CPR — 30 compressions + 2 breaths.', fr: "Vérifiez la respiration. Si elle ne respire pas : RCP — 30 compressions thoraciques + 2 insufflations.", de: "Atmung prüfen. Wenn keine Atmung: Wiederbelebung — 30 Herzdruckmassagen + 2 Beatmungen.", es: "Verifique la respiración. Si no respira: RCP — 30 compresiones + 2 insuflaciones." } }
    ],
    warning: { id: 'Hubungi klinik atau SAR (115) segera!', en: 'Call clinic or SAR (115) immediately!', fr: 'Appelez immédiatement la clinique ou le SAR (115) !', de: 'Rufen Sie sofort die Klinik oder den SAR (115) an!', es: '¡Llame a la clínica o al SAR (115) inmediatamente!' }
  },
  {
    id: 'p2',
    icon: '🪸',
    title: { id: 'Sengatan ubur-ubur & karang', en: 'Jellyfish & Coral sting', fr: 'Piqûre de méduse et de corail', de: 'Quallen- und Korallenstich', es: 'Picadura de medusa y coral' },
    tags: ['SEDANG', 'LAUT'],
    steps: [
      { id: 's1', text: { id: 'Jangan gosok area sengatan. Lepas tentakel dengan kartu/penjepit.', en: 'Do NOT rub the sting area. Remove tentacles with a card or tweezers.', fr: "Ne frottez PAS la zone de la piqûre. Retirez les tentacules avec une carte ou une pince à épiler.", de: "Reiben Sie den Stichbereich NICHT ein. Entfernen Sie Tentakel mit einer Karte oder Pinzette.", es: "NO frote el área de la picadura. Retire los tentáculos con una tarjeta o pinzas." } },
      { id: 's2', text: { id: 'Bilas dengan air laut (bukan air tawar). Siram cuka jika ada.', en: 'Rinse with seawater (NOT fresh water). Use vinegar if available.', fr: "Rincez à l'eau de mer (PAS à l'eau douce). Utilisez du vinaigre si disponible.", de: "Mit Meerwasser abspülen (KEIN Süßwasser). Verwenden Sie Essig, falls verfügbar.", es: "Enjuague con agua de mar (NO agua dulce). Use vinagre si está disponible." } }
    ],
    warning: { id: 'Jika sesak napas atau bengkak parah — segera ke klinik!', en: 'If shortness of breath or severe swelling — go to clinic!', fr: "En cas d'essoufflement ou de gonflement important — allez à la clinique !", de: "Bei Atemnot oder starker Schwellung — ab in die Klinik!", es: "Si hay dificultad para respirar o hinchazón severa — ¡vaya a la clínica!" }
  },
  {
    id: 'p3',
    icon: '☀️',
    title: { id: 'Heatstroke / Kelelahan Panas', en: 'Heatstroke / Heat Exhaustion', fr: 'Coup de chaleur / Épuisement par la chaleur', de: 'Hitzeschlag / Hitzeschöpfung', es: 'Golpe de calor / Agotamiento por calor' },
    tags: ['SERIUS', 'DARAT'],
    steps: [
      { id: 's1', text: { id: 'Pindahkan ke tempat teduh dan dingin. Lepaskan pakaian berlebih.', en: 'Move to a cool, shaded area. Remove excess clothing.', fr: "Déplacez-vous dans un endroit frais et ombragé. Retirez les vêtements superflus.", de: "An einen kühlen, schattigen Ort bringen. Überflüssige Kleidung ausziehen.", es: "Mueva a un área fresca y sombreada. Quítese el exceso de ropa." } },
      { id: 's2', text: { id: 'Dinginkan tubuh dengan handuk basah atau air. Beri minum jika sadar.', en: 'Cool the body with wet towels or water. Give water if conscious.', fr: "Refroidissez le corps avec des serviettes humides ou de l'eau. Donnez de l'eau si la personne est consciente.", de: "Körper mit nassen Handtüchern oder Wasser kühlen. Bei Bewusstsein Wasser geben.", es: "Enfríe el cuerpo con toallas húmedas o agua. Dé agua si está consciente." } }
    ],
    warning: { id: 'Jika suhu tubuh sangat tinggi atau pingsan, ini darurat medis!', en: 'If body temperature is very high or unconscious, this is a medical emergency!', fr: "Si la température corporelle est très élevée ou en cas d'évanouissement, il s'agit d'une urgence médicale !", de: "Wenn die Körpertemperatur sehr hoch ist oder Bewusstlosigkeit eintritt, ist dies ein medizinischer Notfall!", es: "Si la temperatura corporal es muy alta o hay pérdida del conocimiento, ¡esto es una emergencia médica!" }
  },
  {
    id: 'p4',
    icon: '🚲',
    title: { id: 'Luka Jatuh / Pendarahan', en: 'Cuts / Bleeding', fr: 'Coupures / Saignements', de: 'Schnittwunden / Blutungen', es: 'Cortes / Sangrado' },
    tags: ['UMUM', 'DARAT'],
    steps: [
      { id: 's1', text: { id: 'Tekan luka dengan kain bersih selama 5-10 menit untuk menghentikan darah.', en: 'Apply pressure to the wound with a clean cloth for 5-10 minutes to stop bleeding.', fr: "Appliquez une pression sur la plaie avec un linge propre pendant 5 à 10 minutes pour arrêter le saignement.", de: "Drücken Sie 5–10 Minuten lang mit einem sauberen Tuch auf die Wunde, um die Blutung zu stoppen.", es: "Aplique presión sobre la herida con un paño limpio durante 5 a 10 minutos para detener el sangrado." } },
      { id: 's2', text: { id: 'Bersihkan dengan air mengalir. Gunakan antiseptik jika tersedia.', en: 'Clean with running water. Use antiseptic if available.', fr: "Nettoyez à l'eau courante. Utilisez un antiseptique si disponible.", de: "Mit fließendem Wasser reinigen. Falls vorhanden, Antiseptikum verwenden.", es: "Limpie con agua corriente. Use antiséptico si está disponible." } }
    ],
    warning: { id: 'Luka dalam atau kotor butuh suntikan tetanus di klinik.', en: 'Deep or dirty wounds need a tetanus shot at the clinic.', fr: "Les plaies profondes ou sales nécessitent une injection antitétanique à la clinique.", de: "Tiefe oder schmutzige Wunden erfordern eine Tetanusimpfung in der Klinik.", es: "Las heridas profundas o sucias necesitan una inyección contra el tétanos en la clínica." }
  },
  {
    id: 'p5',
    icon: '🐈',
    title: { id: 'Darurat Hewan (Kucing/Anjing)', en: 'Animal Emergency (Cat/Dog)', fr: 'Urgence animale (Chat/Chien)', de: 'Tiernotfall (Katze/Hund)', es: 'Emergencia animal (Gato/Perro)' },
    tags: ['HEWAN', 'LUNI'],
    steps: [
      { id: 's1', text: { id: 'Jangan panik. Dekati hewan dengan tenang agar tidak digigit/dicakar.', en: 'Do not panic. Approach the animal calmly to avoid being bitten/scratched.', fr: "Ne paniquez pas. Approchez l'animal calmement pour éviter d'être mordu ou griffé.", de: "Keine Panik. Nähern Sie sich dem Tier ruhig, um Bisse oder Kratzer zu vermeiden.", es: "No entre en pánico. Acérquese al animal con calma para evitar mordeduras o arañazos." } },
      { id: 's2', text: { id: 'Jika terluka, bungkus dengan kain lembut. Hubungi LUNI Lombok segera.', en: 'If injured, wrap in a soft cloth. Contact LUNI Lombok immediately.', fr: "S'il est blessé, enveloppez-le dans un linge doux. Contactez immédiatement LUNI Lombok.", de: "Bei Verletzungen in ein weiches Tuch einwickeln. Kontaktieren Sie sofort LUNI Lombok.", es: "Si está herido, envuélvalo en un paño suave. Póngase en contacto con LUNI Lombok de inmediato." } }
    ],
    warning: { id: 'LUNI Lombok adalah satu-satunya penyelamat hewan di Gili T.', en: 'LUNI Lombok is the only animal rescue on Gili T.', fr: "LUNI Lombok est le seul centre de secours pour animaux sur Gili T.", de: "LUNI Lombok ist die einzige Tierrettung auf Gili T.", es: "LUNI Lombok es el único rescate de animales en Gili T." }
  },
  {
    id: 'p6',
    icon: '🦴',
    title: { id: 'Patah Tulang / Keseleo', en: 'Fracture / Sprain', fr: 'Fracture / Entorse', de: 'Fraktur / Verstauchung', es: 'Fractura / Esguince' },
    tags: ['SERIUS', 'DARAT'],
    steps: [
      { id: 's1', text: { id: 'Jangan gerakkan bagian yang cedera. Gunakan bidai (kayu/papan) jika harus pindah.', en: 'Do not move the injured part. Use a splint (wood/board) if you must move.', fr: "Ne déplacez pas la partie blessée. Utilisez une attelle (bois/planche) si vous devez vous déplacer.", de: "Bewegen Sie den verletzten Teil nicht. Verwenden Sie eine Schiene (Holz/Brett), wenn Sie sich bewegen müssen.", es: "No mueva la parte lesionada. Use una férula (madera/tabla) si debe moverse." } },
      { id: 's2', text: { id: 'Kompres dingin untuk kurangi bengkak. Jangan urut/pijat paksa.', en: 'Apply cold compress to reduce swelling. Do not massage or force movement.', fr: "Appliquez une compresse froide pour réduire le gonflement. Ne massez pas et ne forcez pas le mouvement.", de: "Kalte Kompresse auflegen, um Schwellungen zu reduzieren. Nicht massieren oder gewaltsam bewegen.", es: "Aplique compresas frías para reducir la hinchazón. No masajee ni fuerce el movimiento." } }
    ],
    warning: { id: 'Segera ke klinik untuk Rontgen/X-Ray.', en: 'Go to the clinic immediately for an X-Ray.', fr: "Allez immédiatement à la clinique pour une radiographie.", de: "Gehen Sie sofort für eine Röntgenaufnahme in die Klinik.", es: "Vaya a la clínica de inmediato para una radiografía." }
  },
  {
    id: 'p7',
    icon: '😵',
    title: { id: 'Pingsan / Tidak Sadar', en: 'Fainting / Unconscious', fr: 'Évanouissement / Inconscience', de: 'Ohnmacht / Bewusstlosigkeit', es: 'Desmayo / Inconsciente' },
    tags: ['KRITIS', 'UMUM'],
    steps: [
      { id: 's1', text: { id: 'Baringkan korban, angkat kaki lebih tinggi dari jantung (30cm).', en: 'Lay the victim down, raise legs higher than the heart (30cm).', fr: "Allongez la victime, relevez les jambes plus haut que le cœur (30 cm).", de: "Legen Sie das Opfer hin, heben Sie die Beine höher als das Herz (30 cm).", es: "Acueste a la víctima, levante las piernas más alto que el corazón (30 cm)." } },
      { id: 's2', text: { id: 'Longgarkan pakaian. Beri udara segar. Jangan beri minum saat pingsan.', en: 'Loosen clothing. Provide fresh air. Do not give water while unconscious.', fr: "Desserrez les vêtements. Donnez de l'air frais. Ne donnez pas d'eau pendant l'évanouissement.", de: "Kleidung lockern. Für frische Luft sorgen. Geben Sie während der Ohnmacht kein Wasser.", es: "Afloje la ropa. Proporcione aire fresco. No dé agua mientras esté inconsciente." } }
    ],
    warning: { id: 'Jika tidak bangun dalam 1 menit, hubungi ambulans!', en: 'If they do not wake up within 1 minute, call an ambulance!', fr: "S'ils ne se réveillent pas dans la minute, appelez une ambulance !", de: "Wenn sie nicht innerhalb von 1 Minute aufwachen, rufen Sie einen Krankenwagen!", es: "Si no se despiertan en 1 minuto, ¡llame a una ambulancia!" }
  },
  {
    id: 'p8',
    icon: '🥨',
    title: { id: 'Tersedak', en: 'Choking', fr: 'Étouffement', de: 'Ersticken', es: 'Atragantamiento' },
    tags: ['KRITIS', 'UMUM'],
    steps: [
      { id: 's1', text: { id: 'Minta korban batuk keras. Jika gagal, lakukan Maneuver Heimlich.', en: 'Ask the victim to cough hard. If it fails, perform the Heimlich Maneuver.', fr: "Demandez à la victime de tousser fort. En cas d'échec, effectuez la manœuvre de Heimlich.", de: "Bitten Sie das Opfer, kräftig zu husten. Wenn dies fehlschlägt, führen Sie das Heimlich-Manöver durch.", es: "Pida a la víctima que tosa fuerte. Si falla, realice la Maniobra de Heimlich." } },
      { id: 's2', text: { id: 'Tekan perut di atas pusar dengan kepalan tangan ke arah atas.', en: 'Apply abdominal thrusts above the navel with a fist in an upward motion.', fr: "Appliquez des poussées abdominales au-dessus du nombril avec un poing dans un mouvement vers le haut.", de: "Führen Sie Oberbauchkompressionen oberhalb des Bauchnabels mit einer Faust in einer Aufwärtsbewegung durch.", es: "Aplique compresiones abdominales por encima del ombligo con un puño en un movimiento hacia arriba." } }
    ],
    warning: { id: 'Jika pingsan, segera lakukan CPR!', en: 'If they pass out, start CPR immediately!', fr: "S'ils s'évanouissent, commencez immédiatement la RCP !", de: "Wenn sie ohnmächtig werden, sofort mit der Wiederbelebung beginnen!", es: "Si se desmayan, ¡comience la RCP de inmediato!" }
  },
  {
    id: 'p9',
    icon: '🤢',
    title: { id: 'Keracunan Makanan', en: 'Food Poisoning', fr: 'Intoxication alimentaire', de: 'Lebensmittelvergiftung', es: 'Intoxicación alimentaria' },
    tags: ['SEDANG', 'UMUM'],
    steps: [
      { id: 's1', text: { id: 'Minum banyak air putih atau oralit untuk cegah dehidrasi.', en: 'Drink plenty of water or ORS to prevent dehydration.', fr: "Buvez beaucoup d'eau ou de SRO pour prévenir la déshydratation.", de: "Trinken Sie viel Wasser oder Elektrolytlösung, um eine Dehydrierung zu verhindern.", es: "Beba mucha agua o SRO para prevenir la deshidratación." } },
      { id: 's2', text: { id: 'Istirahat total. Hindari makanan padat sementara.', en: 'Full rest. Avoid solid foods temporarily.', fr: "Repos complet. Évitez temporairement les aliments solides.", de: "Vollständige Ruhe. Vorübergehend auf feste Nahrung verzichten.", es: "Reposo total. Evite los alimentos sólidos temporalmente." } }
    ],
    warning: { id: 'Jika muntah darah atau diare parah, segera ke klinik!', en: 'If vomiting blood or severe diarrhea, go to the clinic immediately!', fr: "En cas de vomissements de sang ou de diarrhée sévère, allez immédiatement à la clinique !", de: "Bei Bluterbrechen oder schwerem Durchfall sofort in die Klinik!", es: "Si hay vómitos con sangre o diarrea severa, ¡vaya a la clínica de inmediato!" }
  },
  {
    id: 'p10',
    icon: '🔥',
    title: { id: 'Luka Bakar', en: 'Burns', fr: 'Brûlures', de: 'Verbrennungen', es: 'Quemaduras' },
    tags: ['SEDANG', 'UMUM'],
    steps: [
      { id: 's1', text: { id: 'Siram dengan air mengalir (suhu ruang) selama 20 menit. Jangan pakai es.', en: 'Rinse with running water (room temp) for 20 minutes. Do not use ice.', fr: "Rincez à l'eau courante (température ambiante) pendant 20 minutes. N'utilisez pas de glace.", de: "20 Minuten lang mit fließendem Wasser (Zimmertemperatur) abspülen. Kein Eis verwenden.", es: "Enjuague con agua corriente (temperatura ambiente) durante 20 minutos. No use hielo." } },
      { id: 's2', text: { id: 'Tutup longgar dengan plastik wrapping bersih atau kain steril.', en: 'Cover loosely with clean plastic wrap or sterile cloth.', fr: "Couvrez lâchement avec du film plastique propre ou un linge stérile.", de: "Locker mit sauberer Plastikfolie oder einem sterilen Tuch abdecken.", es: "Cubra holgadamente con papel film limpio o un paño estéril." } }
    ],
    warning: { id: 'Jangan pecahkan lepuhan. Jangan oleskan odol/mentega.', en: 'Do not pop blisters. Do not apply toothpaste or butter.', fr: "Ne percez pas les ampoules. N'appliquez pas de dentifrice ou de beurre.", de: "Blasen nicht aufstechen. Keine Zahnpasta oder Butter auftragen.", es: "No reviente las ampollas. No aplique pasta de dientes ni mantequilla." }
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

const WEATHER_DESCRIPTIONS: Record<number, Record<Lang, string>> = {
  0: { id: 'Langit cerah', en: 'Clear sky', fr: 'Ciel dégagé', de: 'Klarer Himmel', es: 'Cielo despejado' },
  1: { id: 'Cerah berawan', en: 'Mainly clear', fr: 'Principalement clair', de: 'Überwiegend klar', es: 'Mayormente despejado' },
  2: { id: 'Berawan', en: 'Partly cloudy', fr: 'Partiellement nuageux', de: 'Teilweise bewölkt', es: 'Parcialmente nublado' },
  3: { id: 'Mendung', en: 'Overcast', fr: 'Couvert', de: 'Bedeckt', es: 'Cubierto' },
  45: { id: 'Kabut', en: 'Fog', fr: 'Brouillard', de: 'Nebel', es: 'Niebla' },
  48: { id: 'Kabut rime', en: 'Depositing rime fog', fr: 'Brouillard givrant', de: 'Reifnebel', es: 'Niebla escarchada' },
  51: { id: 'Gerimis ringan', en: 'Light drizzle', fr: 'Bruine légère', de: 'Leichter Nieselregen', es: 'Llovizna ligera' },
  53: { id: 'Gerimis sedang', en: 'Moderate drizzle', fr: 'Bruine modérée', de: 'Mäßiger Nieselregen', es: 'Llovizna moderada' },
  55: { id: 'Gerimis lebat', en: 'Dense drizzle', fr: 'Bruine dense', de: 'Starker Nieselregen', es: 'Llovizna densa' },
  61: { id: 'Hujan ringan', en: 'Slight rain', fr: 'Pluie légère', de: 'Leichter Regen', es: 'Lluvia ligera' },
  63: { id: 'Hujan sedang', en: 'Moderate rain', fr: 'Pluie modérée', de: 'Mäßiger Regen', es: 'Lluvia moderada' },
  65: { id: 'Hujan lebat', en: 'Heavy rain', fr: 'Pluie forte', de: 'Starker Regen', es: 'Lluvia fuerte' },
  80: { id: 'Hujan rintik', en: 'Slight rain showers', fr: 'Averses de pluie légères', de: 'Leichte Regenschauer', es: 'Chubascos de lluvia ligeros' },
  81: { id: 'Hujan deras', en: 'Moderate rain showers', fr: 'Averses de pluie modérées', de: 'Mäßige Regenschauer', es: 'Chubascos de lluvia moderados' },
  82: { id: 'Hujan sangat deras', en: 'Violent rain showers', fr: 'Averses de pluie violentes', de: 'Heftige Regenschauer', es: 'Chubascos de lluvia violentos' },
  95: { id: 'Badai petir', en: 'Thunderstorm', fr: 'Orage', de: 'Gewitter', es: 'Tormenta eléctrica' },
};

const ContactCard = ({ c, t, lang }: { c: any, t: any, lang: Lang }) => (
  <motion.div 
    whileHover={{ scale: 1.01 }}
    whileTap={{ scale: 0.98 }}
    className="bg-gradient-to-br from-[#1a1a1a]/80 to-[#111111]/80 border dark:border-white/5 border-black/5 rounded-3xl p-4 flex items-center gap-4 hover:dark:bg-[#1a1a1a] bg-white transition-all group relative overflow-hidden backdrop-blur-md shadow-sm hover:shadow-md hover:dark:border-white/10 border-black/10"
  >
    <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-transparent via-[#0066FF] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-white/5 to-transparent flex items-center justify-center text-2xl group-hover:scale-110 transition-transform shadow-inner border dark:border-white/5 border-black/5 shrink-0">{c.icon}</div>
    <div className="flex-1 min-w-0 py-1">
      <div className="text-sm font-black truncate dark:text-white text-gray-900 tracking-tight mb-1 drop-shadow-sm">{c.name}</div>
      <div className="text-[9px] dark:text-[#a1a1aa] text-gray-500 font-black uppercase tracking-[0.15em] opacity-80 mb-1.5">{t(c.role as any)}</div>
      <div className="text-[11px] text-[#0066FF] font-mono font-bold tracking-tight flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-[#0066FF] animate-pulse shadow-[0_0_8px_rgba(61,155,255,0.6)]" />
        {c.num}
      </div>
    </div>
    <button 
      onClick={() => makeCall(c.num)} 
      className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#00E5FF]/10 to-[#00E5FF]/5 border border-[#00E5FF]/20 flex items-center justify-center text-[#00E5FF] hover:bg-[#00E5FF] hover:text-[#050505] transition-all shadow-[0_4px_15px_rgba(0,229,176,0.1)] group-hover:shadow-[0_4px_20px_rgba(0,229,176,0.25)] shrink-0"
    >
      <Phone className="w-5 h-5" />
    </button>
  </motion.div>
);

const getSevereWeatherAlerts = (weather: WeatherData | null, lang: Lang) => {
  if (!weather) return [];
  const alerts = [];
  
  // Heavy Rain / Storms (WMO codes 65, 82, 95, 96, 99)
  if ([65, 82, 95, 96, 99].includes(weather.weatherCode)) {
    alerts.push({
      id: 'heavy_rain',
      icon: <CloudLightning className="w-5 h-5" />,
      title: STRINGS.w_storm_t[lang],
      desc: STRINGS.w_storm_d[lang]
    });
  }

  // Strong Winds (> 40 km/h)
  if (weather.windSpeed > 40) {
    alerts.push({
      id: 'strong_wind',
      icon: <Wind className="w-5 h-5" />,
      title: STRINGS.w_wind_t[lang],
      desc: `${STRINGS.w_wind_d[lang]} (${weather.windSpeed} km/h)`
    });
  }

  // High Waves (>= 2.0m)
  if (weather.waveHeight !== null && weather.waveHeight >= 2.0) {
    alerts.push({
      id: 'high_waves',
      icon: <Waves className="w-5 h-5" />,
      title: STRINGS.w_wave_t[lang],
      desc: `${STRINGS.w_wave_d[lang]} (${weather.waveHeight}m)`
    });
  }

  return alerts;
};

const WeatherCard = ({ lang, weather, loading, onRefresh }: { lang: Lang, weather: WeatherData | null, loading: boolean, onRefresh: () => void }) => {
  if (loading && !weather) return (
    <div className="bg-gradient-to-br from-[#1a1a1a]/80 to-[#111111]/80 border dark:border-white/5 border-black/5 rounded-3xl p-8 flex items-center justify-center mb-6 h-48 backdrop-blur-md shadow-sm">
      <RefreshCw className="w-6 h-6 text-[#0066FF] animate-spin drop-shadow-md" />
    </div>
  );

  if (!weather) return null;

  const desc = WEATHER_DESCRIPTIONS[weather.weatherCode] || { 
    id: 'Kondisi normal', 
    en: 'Normal conditions',
    fr: 'Conditions normales',
    de: 'Normale Bedingungen',
    es: 'Condiciones normales'
  };

  const getWeatherIcon = (code: number) => {
    if (code === 0) return <Sun className="w-10 h-10 text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.5)]" />;
    if (code === 1 || code === 2) return <CloudSun className="w-10 h-10 text-yellow-200 drop-shadow-[0_0_15px_rgba(254,240,138,0.5)]" />;
    if (code === 3) return <Cloud className="w-10 h-10 text-slate-300 drop-shadow-[0_0_15px_rgba(203,213,225,0.5)]" />;
    if (code === 45 || code === 48) return <CloudFog className="w-10 h-10 text-slate-400 drop-shadow-[0_0_15px_rgba(148,163,184,0.5)]" />;
    if (code >= 51 && code <= 55) return <CloudDrizzle className="w-10 h-10 text-blue-300 drop-shadow-[0_0_15px_rgba(147,197,253,0.5)]" />;
    if (code >= 61 && code <= 65) return <CloudRain className="w-10 h-10 text-blue-400 drop-shadow-[0_0_15px_rgba(96,165,250,0.5)]" />;
    if (code >= 80 && code <= 82) return <CloudRain className="w-10 h-10 text-blue-400 drop-shadow-[0_0_15px_rgba(96,165,250,0.5)]" />;
    if (code >= 95) return <CloudLightning className="w-10 h-10 text-amber-400 drop-shadow-[0_0_15px_rgba(251,191,36,0.5)]" />;
    return <Sun className="w-10 h-10 text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.5)]" />;
  };

  return (
    <div className="bg-gradient-to-br from-[#1a2a44]/90 to-[#111111]/90 border dark:border-white/10 border-black/10 rounded-[2.5rem] p-7 relative overflow-hidden mb-8 shadow-[0_20px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl ring-1 ring-white/5">
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#0066FF] via-[#00E5FF] to-[#0066FF] animate-gradient-x opacity-80" />
      <div className="absolute -right-20 -top-20 w-64 h-64 bg-[#0066FF]/5 rounded-full blur-3xl pointer-events-none" />
      
      <div className="flex items-start justify-between mb-8 relative z-10">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 bg-gradient-to-br from-white/10 to-transparent rounded-[1.5rem] flex items-center justify-center shadow-inner border dark:border-white/10 border-black/10 shrink-0">
            {getWeatherIcon(weather.weatherCode)}
          </div>
          <div className="py-1">
            <div className="text-[10px] dark:text-[#a1a1aa] text-gray-500 font-black uppercase tracking-[0.25em] mb-1.5 flex items-center gap-2">
              <MapPin className="w-3 h-3 text-[#0066FF]" />
              Gili Trawangan
            </div>
            <div className="text-sm font-black text-[#00E5FF] flex items-center gap-2 drop-shadow-md">
              <div className="w-2 h-2 rounded-full bg-[#00E5FF] animate-pulse shadow-[0_0_8px_rgba(0,229,176,0.6)]" />
              {desc[lang].toUpperCase()}
            </div>
          </div>
        </div>
        <button 
          onClick={onRefresh} 
          disabled={loading}
          className="p-3 dark:bg-white/5 bg-black/5 hover:dark:bg-white/10 bg-black/10 rounded-2xl transition-all dark:text-[#a1a1aa] text-gray-500 hover:dark:text-white text-gray-900 disabled:opacity-50 border dark:border-white/5 border-black/5 shadow-sm active:scale-95"
        >
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
        </button>
      </div>

      <div className="flex items-baseline gap-3 mb-8 relative z-10">
        <span className="text-7xl font-black dark:text-white text-gray-900 tracking-tighter drop-shadow-[0_0_20px_rgba(255,255,255,0.2)]">
          {Math.round(weather.temp)}°
        </span>
        <div className="flex flex-col justify-end pb-2">
          <span className="text-sm font-black dark:text-[#a1a1aa] text-gray-500 uppercase tracking-[0.2em] mb-1">Celsius</span>
          <span className="text-[10px] font-black text-[#0066FF] uppercase tracking-widest bg-[#0066FF]/10 px-2 py-0.5 rounded-md border border-[#0066FF]/20">
            {t('w_feels')} {Math.round(weather.apparentTemp)}°
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 relative z-10">
        {[
          { icon: Waves, label: 'Waves', val: `${weather.waveHeight?.toFixed(1)}m`, color: 'text-[#0066FF]', bg: 'bg-[#0066FF]/10 border-[#0066FF]/20' },
          { icon: Wind, label: 'Wind', val: `${Math.round(weather.windSpeed)} km/h`, color: 'text-[#00E5FF]', bg: 'bg-[#00E5FF]/10 border-[#00E5FF]/20' },
          { icon: Droplets, label: 'Humidity', val: `${weather.humidity}%`, color: 'text-[#FFB800]', bg: 'bg-[#FFB800]/10 border-[#FFB800]/20' },
          { icon: Navigation, label: 'Direction', val: `${weather.windDir}°`, color: 'text-[#FF4444]', bg: 'bg-[#FF4444]/10 border-[#FF4444]/20' },
        ].map((item, i) => (
          <div key={i} className="bg-gradient-to-br from-white/5 to-transparent border dark:border-white/5 border-black/5 rounded-2xl p-4 flex items-center gap-4 shadow-sm hover:dark:bg-white/10 bg-black/10 transition-colors">
            <div className={cn("p-2.5 rounded-xl border shadow-inner", item.bg)}>
              <item.icon className={cn("w-5 h-5 drop-shadow-md", item.color)} />
            </div>
            <div>
              <div className="text-[9px] dark:text-[#a1a1aa] text-gray-500 uppercase font-black tracking-[0.15em] mb-0.5">{item.label}</div>
              <div className="text-sm font-black dark:text-white text-gray-900 tracking-tight drop-shadow-sm font-mono">{item.val}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function GiliGuard() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);

  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding');
    if (!hasSeenOnboarding) {
      setShowOnboarding(true);
    }
  }, []);

  const finishOnboarding = () => {
    localStorage.setItem('hasSeenOnboarding', 'true');
    setShowOnboarding(false);
  };

  const [lang, setLang] = useState<Lang>('id');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const savedTheme = localStorage.getItem('giliguard_theme') as 'dark' | 'light';
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('giliguard_theme', theme);
  }, [theme]);
  const [activePage, setActivePage] = useState<Page>('beranda');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [mounted, setMounted] = useState(false);
  const [infoSubPage, setInfoSubPage] = useState<string | null>(null);
  const [showSOSModal, setShowSOSModal] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isSOSSent, setIsSOSSent] = useState(false);
  const [sosTimer, setSosTimer] = useState(0);
  const [coords, setCoords] = useState<string>('--');
  const [history, setHistory] = useState<{ time: string, coords: string }[]>([]);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [p3kSearch, setP3kSearch] = useState('');
  const [p3kCategory, setP3kCategory] = useState('ALL');
  const [expandedGuide, setExpandedGuide] = useState<string | null>(null);
  const [completedTasks, setCompletedTasks] = useState<string[]>([]);
  const [mapQuery, setMapQuery] = useState('');

  // AI Chat state
  const [showAiChat, setShowAiChat] = useState(false);
  const [aiMessages, setAiMessages] = useState<{role: 'user' | 'model', text: string}[]>([]);
  const [aiInput, setAiInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // App Settings state
  const [appSettings, setAppSettings] = useState({
    notifications: true,
    location: true,
    dataSaver: false
  });

  useEffect(() => {
    if (showAiChat) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [aiMessages, showAiChat, isAiLoading]);

  // Lost & Found state
  const [lfItems, setLfItems] = useState<LostFoundItem[]>([]);
  const [showLfForm, setShowLfForm] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [lfLoading, setLfLoading] = useState(true);
  const [isModerating, setIsModerating] = useState(false);
  const [lfFilter, setLfFilter] = useState<'all' | 'lost' | 'found'>('all');
  const [lfSearch, setLfSearch] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [newLf, setNewLf] = useState({
    type: 'lost' as 'lost' | 'found',
    title: '',
    description: '',
    location: '',
    contact: '',
    timeLost: '',
    image: ''
  });
  const [commentInputs, setCommentInputs] = useState<{[key: string]: string}>({});
  const [editingComment, setEditingComment] = useState<{ itemId: string, commentId: string, text: string } | null>(null);
  const [sosAlerts, setSosAlerts] = useState<any[]>([]);
  const [expandedComments, setExpandedComments] = useState<{[key: string]: boolean}>({});
  const [toast, setToast] = useState<{show: boolean, message: string, type: 'success' | 'error' | 'info'}>({show: false, message: '', type: 'success'});

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({show: true, message, type});
    setTimeout(() => setToast(prev => ({...prev, show: false})), 3000);
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showToast(t('t_img_size'), 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        // Compress to JPEG with 0.7 quality
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        setNewLf(prev => ({ ...prev, image: dataUrl }));
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Auth setup
  useEffect(() => {
    setMounted(true);
    
    // Load persisted data
    if (typeof window !== 'undefined') {
      const savedLang = localStorage.getItem('gili_lang');
      if (savedLang) setLang(savedLang as Lang);

      const savedSettings = localStorage.getItem('gili_settings');
      if (savedSettings) setAppSettings(JSON.parse(savedSettings));

      const savedHistory = localStorage.getItem('gili_history');
      if (savedHistory) setHistory(JSON.parse(savedHistory));
    }

    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return unsub;
  }, []);

  // Persist data when changed
  useEffect(() => {
    if (mounted) localStorage.setItem('gili_lang', lang);
  }, [lang, mounted]);

  useEffect(() => {
    if (mounted) localStorage.setItem('gili_settings', JSON.stringify(appSettings));
  }, [appSettings, mounted]);

  useEffect(() => {
    if (mounted) localStorage.setItem('gili_history', JSON.stringify(history));
  }, [history, mounted]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Fetch SOS Alerts (Admin Only)
  useEffect(() => {
    if (!user || user.email !== 'zohidydy@gmail.com') {
      setSosAlerts([]);
      return;
    }
    
    const q = query(collection(db, 'sos_alerts'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const alerts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSosAlerts(alerts);
    }, (error) => {
      console.error('Firestore Error (SOS Alerts):', error);
    });
    
    return () => unsubscribe();
  }, [user]);

  const resolveSOS = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'sos_alerts', id));
    } catch (error) {
      console.error('Failed to resolve SOS:', error);
    }
  };

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

  const safeJsonParse = (text: string | undefined) => {
    if (!text) return { isAppropriate: true, reason: '' };
    try {
      const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(cleanText);
    } catch (e) {
      console.error('JSON parse error:', e, text);
      return { isAppropriate: true, reason: 'Parse error, allowing by default' };
    }
  };

  const handleLfSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setIsModerating(true);
    try {
      // AI Moderation
      const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY! });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Moderasi konten berikut untuk aplikasi "GiliGuard" (Aplikasi Keamanan Gili Trawangan). 
        Konten adalah postingan "Lost & Found".
        Judul: ${newLf.title}
        Deskripsi: ${newLf.description}
        
        Aturan:
        1. Tidak boleh ada kata kasar/umpatan.
        2. Tidak boleh ada konten seksual/pornografi.
        3. Tidak boleh ada penipuan atau barang ilegal.
        4. Harus relevan dengan barang hilang atau ditemukan.
        
        Berikan jawaban dalam format JSON: { "isAppropriate": boolean, "reason": "string" }`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              isAppropriate: { type: Type.BOOLEAN },
              reason: { type: Type.STRING }
            },
            required: ["isAppropriate", "reason"]
          }
        }
      });

      const moderation = safeJsonParse(response.text);
      if (!moderation.isAppropriate) {
        showToast(`${t('t_rejected')}: ${moderation.reason}`, 'error');
        setIsModerating(false);
        return;
      }

      await addDoc(collection(db, 'lost_and_found'), {
        ...newLf,
        createdAt: serverTimestamp(),
        status: 'active',
        uid: user.uid
      });
      setShowLfForm(false);
      setNewLf({ type: 'lost', title: '', description: '', location: '', contact: '', timeLost: '', image: '' });
      showToast(t('lf_success'), 'success');
    } catch (error) {
      console.error("Error adding document: ", error);
      showToast(t('t_post_fail'), 'error');
    } finally {
      setIsModerating(false);
    }
  };

  const confirmDeleteLfItem = async () => {
    if (!itemToDelete) return;
    try {
      await deleteDoc(doc(db, 'lost_and_found', itemToDelete));
      showToast(t('t_del_success'), 'success');
    } catch (error) {
      console.error("Error deleting document: ", error);
      showToast(t('t_del_fail'), 'error');
    } finally {
      setItemToDelete(null);
    }
  };

  const deleteLfItem = (id: string) => {
    setItemToDelete(id);
  };

  const handleAddComment = async (itemId: string) => {
    if (!user) {
      showToast(t('t_login_comment'), 'error');
      return;
    }
    const text = commentInputs[itemId]?.trim();
    if (!text) return;

    setIsModerating(true);
    try {
      // AI Moderation for comments
      const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY! });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Moderasi komentar berikut untuk aplikasi "GiliGuard".
        Komentar: ${text}
        
        Aturan: Tidak boleh ada kata kasar, umpatan, atau pelecehan.
        
        Berikan jawaban dalam format JSON: { "isAppropriate": boolean, "reason": "string" }`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              isAppropriate: { type: Type.BOOLEAN },
              reason: { type: Type.STRING }
            },
            required: ["isAppropriate", "reason"]
          }
        }
      });

      const moderation = safeJsonParse(response.text);
      if (!moderation.isAppropriate) {
        showToast(`${t('t_rejected_comment')}: ${moderation.reason}`, 'error');
        setIsModerating(false);
        return;
      }

      const newComment: CommentItem = {
        id: Date.now().toString(),
        text,
        authorName: user.displayName || user.email?.split('@')[0] || 'User',
        authorUid: user.uid,
        createdAt: Date.now()
      };
      
      await updateDoc(doc(db, 'lost_and_found', itemId), {
        comments: arrayUnion(newComment)
      });
      
      setCommentInputs(prev => ({...prev, [itemId]: ''}));
      showToast(t('t_comment_success'), 'success');
    } catch (error) {
      console.error("Error adding comment: ", error);
      showToast(t('t_comment_fail'), 'error');
    } finally {
      setIsModerating(false);
    }
  };

  const handleEditComment = async () => {
    if (!user || !editingComment) return;
    const { itemId, commentId, text } = editingComment;
    const trimmedText = text.trim();
    if (!trimmedText) return;

    setIsModerating(true);
    try {
      // AI Moderation for edited comments
      const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY! });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Moderasi komentar berikut untuk aplikasi "GiliGuard".
        Komentar: ${trimmedText}
        
        Aturan: Tidak boleh ada kata kasar, umpatan, atau pelecehan.
        
        Berikan jawaban dalam format JSON: { "isAppropriate": boolean, "reason": "string" }`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              isAppropriate: { type: Type.BOOLEAN },
              reason: { type: Type.STRING }
            },
            required: ["isAppropriate", "reason"]
          }
        }
      });

      const moderation = safeJsonParse(response.text);
      if (!moderation.isAppropriate) {
        showToast(`${t('t_rejected_comment')}: ${moderation.reason}`, 'error');
        setIsModerating(false);
        return;
      }

      const itemRef = doc(db, 'lost_and_found', itemId);
      const itemSnap = await getDoc(itemRef);
      if (itemSnap.exists()) {
        const data = itemSnap.data() as LostFoundItem;
        const updatedComments = data.comments?.map(c => 
          c.id === commentId ? { ...c, text: trimmedText } : c
        ) || [];
        
        await updateDoc(itemRef, { comments: updatedComments });
        setEditingComment(null);
        showToast(t('t_comment_update'), 'success');
      }
    } catch (error) {
      console.error("Error editing comment: ", error);
      showToast(t('t_del_fail'), 'error');
    } finally {
      setIsModerating(false);
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
      dynamicTips[0] = t('tip_rain_1');
      dynamicTips[5] = t('tip_rain_2');
    }

    if (weather.temp > 32) { // Very hot
      dynamicTips[2] = t('tip_heat');
    }

    if (weather.waveHeight && weather.waveHeight > 1.2) { // High waves
      dynamicTips[3] = t('tip_wave');
    }

    if (weather.windSpeed > 20) { // Strong wind
      dynamicTips[1] = t('tip_wind');
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

  const triggerSOS = useCallback(async () => {
    setShowSOSModal(false);
    setIsSOSSent(true);
    setSosTimer(0);
    setHistory(prev => [{ time: new Date().toLocaleTimeString(), coords }, ...prev]);
    
    // Broadcast to Firestore for real-time monitoring
    try {
      await addDoc(collection(db, 'sos_alerts'), {
        uid: user?.uid || null,
        userName: user?.displayName || user?.email?.split('@')[0] || 'Anonymous',
        coords,
        timestamp: serverTimestamp(),
        status: 'active'
      });
    } catch (error) {
      console.error('Failed to broadcast SOS to Firestore:', error);
    }

    const waNumber = '6285293514808';
    const mapsLink = `https://www.google.com/maps/search/?api=1&query=${coords}`;
    const message = encodeURIComponent(`🚨 DARURAT! SAYA BUTUH BANTUAN DI GILI TRAWANGAN 🚨\n\nLokasi saya saat ini:\n${mapsLink}\n\nKoordinat: ${coords}`);
    window.open(`https://wa.me/${waNumber}?text=${message}`, '_blank');
    
    setTimeout(() => {
      makeCall('112');
    }, 1500);
  }, [coords, user]);

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

  const t = (key: keyof typeof STRINGS) => {
    if (!STRINGS[key]) {
      console.warn(`Missing translation key: ${key}`);
      return key as string;
    }
    return STRINGS[key][lang];
  };

  const handleAiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiInput.trim() || isAiLoading) return;

    const userText = aiInput.trim();
    setAiInput('');
    setAiMessages(prev => [...prev, { role: 'user', text: userText }]);
    setIsAiLoading(true);

    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY });
      
      const prompt = `You are a first aid assistant for Gili Trawangan. The user is asking for first aid advice. Provide clear, concise, and safe first aid instructions. Important context: Gili Trawangan has no motorized vehicles, only horse carts (cidomo) and bicycles. There are local clinics but for serious emergencies, evacuation to Lombok by speedboat is required. Always advise them to contact local medical services (like Prima Medika or Blue Island Medical) or call 112 for severe emergencies. Respond in ${t('nav1') === 'Beranda' ? 'Indonesian' : lang === 'fr' ? 'French' : lang === 'de' ? 'German' : lang === 'es' ? 'Spanish' : 'English'}.\n\nUser: ${userText}`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });

      setAiMessages(prev => [...prev, { role: 'model', text: response.text || 'Sorry, I could not generate a response.' }]);
    } catch (error) {
      console.error('AI Error:', error);
      setAiMessages(prev => [...prev, { role: 'model', text: t('ai_err') }]);
    } finally {
      setIsAiLoading(false);
    }
  };

  const severeWeatherAlerts = getSevereWeatherAlerts(weather, lang);

  return (
    <div className="max-w-md mx-auto h-[100dvh] dark:bg-[#050505] bg-gray-50 dark:text-[#ffffff] text-gray-900 flex flex-col relative overflow-hidden">
      
      {/* Header */}
      <header className="flex-shrink-0 bg-gradient-to-b from-[#050505]/95 to-[#050505]/80 backdrop-blur-2xl border-b dark:border-white/5 border-black/5 p-4 flex items-center gap-4 z-30 sticky top-0 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
        <div className="relative group cursor-pointer" onClick={() => setActivePage('beranda')}>
          <div className="absolute -inset-1.5 bg-gradient-to-tr from-[#FF4444] to-[#0066FF] rounded-2xl blur-md opacity-40 group-hover:opacity-70 transition duration-500"></div>
          <div className="relative w-11 h-11 bg-gradient-to-br from-[#1a1a1a] to-[#111111] border dark:border-white/10 border-black/10 rounded-2xl flex items-center justify-center text-[#FF4444] shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] overflow-hidden group-hover:scale-105 transition-transform">
            <Shield className="w-5 h-5 fill-[#FF4444]/20 drop-shadow-[0_0_8px_rgba(255,60,60,0.5)]" />
            <div className="absolute inset-0 bg-gradient-to-tr from-[#FF4444]/10 to-transparent pointer-events-none" />
          </div>
        </div>
        <div className="flex-1 min-w-0 py-1">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-lg font-black tracking-tighter dark:text-white text-gray-900 uppercase italic font-display drop-shadow-sm">Gili</span>
            <span className="text-lg font-black tracking-tighter text-[#0066FF] uppercase italic font-display drop-shadow-[0_0_10px_rgba(61,155,255,0.4)]">Guard</span>
            <div className="w-1.5 h-1.5 rounded-full bg-[#00E5FF] animate-pulse ml-1 shadow-[0_0_8px_rgba(0,229,176,0.6)]" />
          </div>
          <div className="text-[10px] dark:text-[#a1a1aa] text-gray-500 font-black uppercase tracking-[0.2em] opacity-80 flex items-center gap-1.5">
            <MapPin className="w-3 h-3 text-[#0066FF]" />
            <span className="truncate">{coords}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 relative">
          <div className="flex dark:bg-[#111111] bg-white border dark:border-white/10 border-black/10 rounded-xl overflow-hidden p-1 shadow-inner ring-1 ring-white/5">
            <button 
              onClick={() => setLang('id')}
              className={cn("px-3 py-1.5 text-[10px] font-black transition-all rounded-lg tracking-wider", lang === 'id' ? "bg-gradient-to-br from-[#0066FF] to-[#0055CC] text-white shadow-md" : "dark:text-[#a1a1aa] text-gray-500 hover:dark:text-white text-gray-900 hover:dark:bg-white/5 bg-black/5")}
            >ID</button>
            <button 
              onClick={() => setLang('en')}
              className={cn("px-3 py-1.5 text-[10px] font-black transition-all rounded-lg tracking-wider", lang === 'en' ? "bg-gradient-to-br from-[#0066FF] to-[#0055CC] text-white shadow-md" : "dark:text-[#a1a1aa] text-gray-500 hover:dark:text-white text-gray-900 hover:dark:bg-white/5 bg-black/5")}
            >EN</button>
          </div>
          
          <div className="relative">
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className={cn(
                "p-3 rounded-xl border transition-all active:scale-95 shadow-sm",
                isMenuOpen || activePage === 'info' || activePage === 'peta'
                  ? "bg-gradient-to-br from-[#0066FF] to-[#0055CC] border-[#0066FF]/50 text-white shadow-[0_0_20px_rgba(61,155,255,0.4)]" 
                  : "bg-gradient-to-br from-[#1a1a1a] to-[#111111] dark:border-white/10 border-black/10 dark:text-[#a1a1aa] text-gray-500 hover:dark:bg-white/10 bg-black/10 hover:dark:text-white text-gray-900 hover:dark:border-white/20 border-black/20"
              )}
            >
              <MoreHorizontal className="w-5 h-5 drop-shadow-sm" />
            </button>

            <AnimatePresence>
              {isMenuOpen && (
                <>
                  <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="fixed inset-0 z-40"
                    onClick={() => setIsMenuOpen(false)}
                  />
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-3 w-56 dark:bg-[#1a1a1a] bg-white border dark:border-white/10 border-black/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] p-2 z-50 backdrop-blur-xl ring-1 ring-white/5"
                  >
                    {[
                      { id: 'peta', icon: MapPin, label: t('nav4') },
                      { id: 'info', icon: Settings, label: t('tab_info') },
                      { id: 'about', icon: Info, label: t('lbl_about') },
                      { id: 'feedback', icon: MessageSquare, label: t('lbl_feedback') },
                      { id: 'dev', icon: UserIcon, label: t('lbl_dev') },
                    ].map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          if (['about', 'feedback', 'dev'].includes(item.id)) {
                            setActivePage('info');
                            setInfoSubPage(item.id as any);
                          } else {
                            setActivePage(item.id as Page);
                            setInfoSubPage(null);
                          }
                          setIsMenuOpen(false);
                        }}
                        className={cn(
                          "w-full flex items-center gap-3 p-3 rounded-xl transition-all text-xs font-bold",
                          (activePage === item.id || (['about', 'feedback', 'dev'].includes(item.id) && infoSubPage === item.id))
                            ? "bg-[#0066FF]/10 text-[#0066FF]" 
                            : "dark:text-[#a1a1aa] text-gray-500 hover:dark:bg-white/5 hover:bg-black/5 hover:dark:text-white hover:text-gray-900"
                        )}
                      >
                        <item.icon className="w-4 h-4" />
                        {item.label}
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>
      
      {/* Disclaimer Banner */}
      <div className="bg-[#FFB800]/5 border-b border-[#FFB800]/10 px-4 py-1.5 flex items-center gap-2.5 z-20 backdrop-blur-sm">
        <AlertCircle className="w-3.5 h-3.5 text-[#FFB800] shrink-0 opacity-80" />
        <p className="text-[9px] font-bold text-[#FFB800]/90 uppercase tracking-[0.1em] leading-tight">
          {t('disclaimer')}
        </p>
      </div>

      {/* Main Scroll Area */}
      <main className="flex-1 overflow-y-auto p-5 pb-32 scrollbar-hide">
        <AnimatePresence mode="wait">
          
          {/* PAGE: BERANDA */}
          {activePage === 'beranda' && (
            <motion.div key="beranda" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
              
              {/* Dashboard Header */}
              <div className="flex items-center justify-between px-2 pt-2">
                <div>
                  <div className="text-[11px] dark:text-[#a1a1aa] text-gray-500 font-black uppercase tracking-[0.25em] mb-1.5 flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full bg-[#0066FF]" />
                    {t('lbl_welcome')}
                  </div>
                  <div className="text-3xl font-black dark:text-white text-gray-900 tracking-tighter font-display drop-shadow-md">
                    {mounted ? currentTime.toLocaleTimeString(lang === 'id' ? 'id-ID' : lang === 'fr' ? 'fr-FR' : lang === 'de' ? 'de-DE' : lang === 'es' ? 'es-ES' : 'en-US', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                    <span className="text-sm font-bold dark:text-[#a1a1aa] text-gray-500 ml-2 tracking-normal uppercase">
                      {mounted ? currentTime.toLocaleDateString(lang === 'id' ? 'id-ID' : lang === 'fr' ? 'fr-FR' : lang === 'de' ? 'de-DE' : lang === 'es' ? 'es-ES' : 'en-US', { weekday: 'short', day: 'numeric', month: 'short' }) : '---'}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  {severeWeatherAlerts.length > 0 ? (
                    <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#FF4444]/10 to-[#FF4444]/5 border border-[#FF4444]/20 shadow-[0_4px_15px_rgba(255,68,68,0.1)]">
                      <div className="w-2 h-2 rounded-full bg-[#FF4444] animate-pulse shadow-[0_0_8px_rgba(255,68,68,0.6)]" />
                      <span className="text-[10px] font-black text-[#FF4444] uppercase tracking-widest">{t('w_alert_title')}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#00E5FF]/10 to-[#00E5FF]/5 border border-[#00E5FF]/20 shadow-[0_4px_15px_rgba(0,229,176,0.1)]">
                      <div className="w-2 h-2 rounded-full bg-[#00E5FF] animate-pulse shadow-[0_0_8px_rgba(0,229,176,0.6)]" />
                      <span className="text-[10px] font-black text-[#00E5FF] uppercase tracking-widest">{t('lbl_sys_secure')}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Severe Weather Alerts */}
              {severeWeatherAlerts.length > 0 && (
                <div className="space-y-3">
                  {severeWeatherAlerts.map(alert => (
                    <motion.div 
                      key={alert.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-gradient-to-r from-[#FF4444]/20 to-[#FF4444]/5 border border-[#FF4444]/30 rounded-2xl p-4 flex items-start gap-4 shadow-[0_4px_20px_rgba(255,68,68,0.15)] relative overflow-hidden"
                    >
                      <div className="absolute top-0 left-0 bottom-0 w-1 bg-[#FF4444]" />
                      <div className="w-10 h-10 rounded-xl bg-[#FF4444]/20 flex items-center justify-center text-[#FF4444] shrink-0 border border-[#FF4444]/30">
                        {alert.icon}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-display font-bold text-[#FF4444] tracking-tight mb-1 flex items-center gap-2">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          {alert.title}
                        </div>
                        <div className="text-xs text-[#e4e4e7] font-mono leading-relaxed opacity-90">
                          {alert.desc}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Weather Widget (Compact) */}
              <div 
                onClick={() => setActivePage('info')}
                className="bg-gradient-to-br from-[#1a1a1a]/90 to-[#111111]/90 border dark:border-white/10 border-black/10 rounded-[2.5rem] p-6 flex flex-col gap-5 shadow-[0_15px_35px_rgba(0,0,0,0.4)] group cursor-pointer hover:border-[#0066FF]/40 hover:shadow-[0_15px_40px_rgba(61,155,255,0.2)] transition-all duration-300 ring-1 ring-white/5 backdrop-blur-xl relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#0066FF] to-transparent opacity-50 group-hover:opacity-100 transition-opacity" />
                <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-5">
                    <div className="w-16 h-16 bg-gradient-to-br from-white/10 to-transparent rounded-[1.5rem] flex items-center justify-center border dark:border-white/10 border-black/10 shadow-inner group-hover:scale-110 transition-transform duration-300 shrink-0">
                      {weather ? (
                        <div className="text-4xl drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
                          {weather.weatherCode === 0 ? '☀️' : weather.weatherCode < 3 ? '⛅' : weather.weatherCode < 50 ? '☁️' : '🌧️'}
                        </div>
                      ) : (
                        <RefreshCw className="w-6 h-6 text-[#0066FF] animate-spin drop-shadow-md" />
                      )}
                    </div>
                    <div className="py-1">
                      <div className="text-[10px] dark:text-[#a1a1aa] text-gray-500 font-black uppercase tracking-[0.2em] mb-1.5 group-hover:text-[#0066FF] transition-colors">{t('lbl_cur_weather')}</div>
                      <div className="text-lg font-black dark:text-white text-gray-900 tracking-tight drop-shadow-sm flex items-center gap-2">
                        {weather ? (
                          <>
                            <span className="text-[#00E5FF]">{Math.round(weather.temp)}°C</span>
                            <span className="dark:text-[#52525b] text-gray-400">•</span>
                            <span>{WEATHER_DESCRIPTIONS[weather.weatherCode]?.[lang] || '...'}</span>
                          </>
                        ) : 'Loading...'}
                      </div>
                    </div>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-white/5 to-transparent flex items-center justify-center group-hover:bg-[#0066FF] transition-all duration-300 shadow-sm border dark:border-white/5 border-black/5 shrink-0">
                    <Navigation className="w-5 h-5 dark:text-[#a1a1aa] text-gray-500 group-hover:dark:text-white text-gray-900 rotate-90 transition-colors duration-300 drop-shadow-sm" />
                  </div>
                </div>

                {/* Tide & Wave Info */}
                {weather && (
                  <div className="flex items-center gap-3 pt-5 border-t dark:border-white/5 border-black/5 relative z-10">
                    <div className="flex items-center gap-2.5 bg-gradient-to-r from-[#0066FF]/10 to-transparent px-4 py-2.5 rounded-xl border border-[#0066FF]/20 flex-1 shadow-sm">
                      <Waves className="w-4 h-4 text-[#0066FF] drop-shadow-sm" />
                      <span className="text-[11px] font-black text-[#0066FF] tracking-wide uppercase">
                        {weather.waveHeight?.toFixed(1) || '--'}m {t('w_waves')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5 bg-gradient-to-r from-[#00E5FF]/10 to-transparent px-4 py-2.5 rounded-xl border border-[#00E5FF]/20 flex-1 shadow-sm">
                      <Droplets className="w-4 h-4 text-[#00E5FF] drop-shadow-sm" />
                      <span className="text-[11px] font-black text-[#00E5FF] tracking-wide uppercase">
                        {(() => {
                          const h = new Date().getHours();
                          if ((h >= 8 && h <= 12) || (h >= 20 || h <= 0)) return t('w_high_tide');
                          if ((h >= 14 && h <= 18) || (h >= 2 && h <= 6)) return t('w_low_tide');
                          return t('w_transition');
                        })()}
                      </span>
                    </div>
                  </div>
                )}
              </div>
              
              {/* SOS Button Section */}
              <div className="flex flex-col items-center gap-6 py-8 relative">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#FF4444]/5 to-transparent pointer-events-none" />
                <div className="w-64 h-64 rounded-full bg-[#FF4444]/5 flex items-center justify-center relative">
                  <motion.div 
                    animate={{ scale: [1, 1.3, 1], opacity: [0.1, 0.5, 0.1] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute inset-0 rounded-full border-2 border-[#FF4444]/30" 
                  />
                  <motion.div 
                    animate={{ scale: [1, 1.6, 1], opacity: [0.05, 0.2, 0.05] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                    className="absolute inset-[-20px] rounded-full border border-[#FF4444]/20" 
                  />
                  <button 
                    onClick={() => setShowSOSModal(true)}
                    className="w-48 h-48 rounded-full bg-gradient-to-br from-[#FF6666] via-[#FF4444] to-[#CC0000] shadow-[0_0_80px_rgba(255,60,60,0.6)] flex flex-col items-center justify-center gap-2 active:scale-90 transition-all duration-300 z-10 border-[6px] border-[#050505] ring-4 ring-[#FF4444]/40 group relative overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />
                    <div className="text-6xl font-black dark:text-white text-gray-900 tracking-widest font-display drop-shadow-[0_4px_10px_rgba(0,0,0,0.4)] group-hover:scale-110 transition-transform group-active:scale-95">SOS</div>
                    <div className="text-[11px] dark:text-white text-gray-900 font-black uppercase tracking-[0.3em] drop-shadow-md group-hover:tracking-[0.4em] transition-all">{t('sos_sub')}</div>
                  </button>
                </div>
                <div className="text-[11px] dark:text-[#a1a1aa] text-gray-500 font-black uppercase tracking-widest text-center max-w-[240px] leading-relaxed opacity-80 mb-2 drop-shadow-sm">{t('sos_hint')}</div>
                <button 
                  onClick={() => {
                    const mapsLink = `https://www.google.com/maps/search/?api=1&query=${coords}`;
                    const text = `${t('lbl_share_text')} ${mapsLink}`;
                    if (navigator.share) {
                      navigator.share({ title: 'Lokasi Saya / My Location', text, url: mapsLink }).catch(() => {});
                    } else {
                      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                    }
                  }}
                  className="flex items-center gap-2.5 px-6 py-3 bg-gradient-to-r from-[#1a1a1a] to-[#111111] border dark:border-white/10 border-black/10 rounded-full text-xs font-bold text-[#0066FF] hover:bg-[#0066FF]/10 hover:border-[#0066FF]/30 transition-all active:scale-95 shadow-[0_4px_15px_rgba(0,0,0,0.3)] ring-1 ring-white/5"
                >
                  <Share2 className="w-4 h-4" />
                  {t('lbl_share_loc')}
                </button>
              </div>

              {/* Quick Actions Grid */}
              <div>
                <div className="text-[11px] font-black dark:text-[#52525b] text-gray-400 uppercase tracking-[0.2em] mb-4 px-1 font-mono flex items-center gap-2">
                  <div className="w-8 h-[1px] bg-[#52525b]/30" />
                  {t('lbl_quick')}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { icon: '📦', label: t('lf_report'), page: 'lostfound', color: 'from-blue-500/20 to-blue-600/5', border: 'border-blue-500/20', shadow: 'shadow-blue-500/10' },
                    { icon: '📜', label: t('lbl_rules'), page: 'rules', color: 'from-emerald-500/20 to-emerald-600/5', border: 'border-emerald-500/20', shadow: 'shadow-emerald-500/10' },
                    { icon: '📍', label: t('q3'), page: 'peta', color: 'from-orange-500/20 to-orange-600/5', border: 'border-orange-500/20', shadow: 'shadow-orange-500/10' },
                    { icon: '🚑', label: t('q4'), call: '119', color: 'from-red-500/20 to-red-600/5', border: 'border-red-500/20', shadow: 'shadow-red-500/10' },
                    { icon: '👮', label: t('q5'), call: '110', color: 'from-indigo-500/20 to-indigo-600/5', border: 'border-indigo-500/20', shadow: 'shadow-indigo-500/10' },
                    { icon: '⚓', label: t('q6'), call: '115', color: 'from-cyan-500/20 to-cyan-600/5', border: 'border-cyan-500/20', shadow: 'shadow-cyan-500/10' },
                  ].map((item, i) => (
                    <motion.button 
                      key={i}
                      whileTap={{ scale: 0.95 }}
                      whileHover={{ scale: 1.05, y: -4 }}
                      onClick={() => {
                        if (item.page === 'rules') {
                          setActivePage('info');
                          setInfoSubPage('rules');
                        } else if (item.page === 'lostfound') {
                          setActivePage('lostfound');
                          setTimeout(() => {
                            const reportBtn = document.getElementById('btn-report-lf');
                            if (reportBtn) reportBtn.click();
                          }, 100);
                        } else if (item.page) {
                          setActivePage(item.page as Page);
                        } else {
                          makeCall(item.call || '');
                        }
                      }}
                      className={cn(
                        "bg-gradient-to-br border rounded-[1.5rem] p-4 flex flex-col items-center gap-3 transition-all backdrop-blur-sm relative overflow-hidden group", 
                        item.color, 
                        item.border,
                        item.shadow
                      )}
                    >
                      <div className="absolute inset-0 dark:bg-white/5 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="text-3xl drop-shadow-md group-hover:scale-110 transition-transform">{item.icon}</div>
                      <div className="text-[10px] font-black dark:text-[#a1a1aa] text-gray-500 text-center leading-tight uppercase tracking-tight drop-shadow-sm group-hover:dark:text-white text-gray-900 transition-colors">{item.label}</div>
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Local Quick Dial */}
              <div>
                <div className="text-[11px] font-black dark:text-[#52525b] text-gray-400 uppercase tracking-[0.2em] mb-4 px-1 font-mono flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-[1px] bg-[#52525b]/30" />
                    {t('lbl_quick_dial')}
                  </div>
                  <button onClick={() => setActivePage('kontak')} className="text-[#0066FF] text-[10px] uppercase tracking-widest hover:underline font-bold">
                    {t('lbl_see_all')}
                  </button>
                </div>
                <div className="space-y-3">
                  {EMERGENCY_CONTACTS.filter(c => ['Prima Medika Gili', 'Polisi Gili Indah', 'Damkar Gili Trawangan'].includes(c.name)).map((c, i) => (
                    <div key={i} className="bg-gradient-to-br from-[#1a1a1a]/80 to-[#111111]/80 border dark:border-white/5 border-black/5 rounded-[1.5rem] p-4 flex items-center justify-between group hover:dark:border-white/10 border-black/10 hover:dark:bg-[#1a1a1a] bg-white transition-all backdrop-blur-md shadow-sm">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-white/5 to-transparent flex items-center justify-center text-2xl shadow-inner border dark:border-white/5 border-black/5 group-hover:scale-110 transition-transform">
                          {c.icon}
                        </div>
                        <div>
                          <div className="text-xs font-black dark:text-white text-gray-900 uppercase tracking-tight mb-1 drop-shadow-sm">{c.name}</div>
                          <div className="text-[10px] text-[#0066FF] font-bold font-mono tracking-tight flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#0066FF] animate-pulse shadow-[0_0_5px_rgba(61,155,255,0.5)]" />
                            {c.num}
                          </div>
                        </div>
                      </div>
                      <button 
                        onClick={() => makeCall(c.num)}
                        className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#00E5FF]/10 to-[#00E5FF]/5 border border-[#00E5FF]/20 text-[#00E5FF] flex items-center justify-center hover:bg-[#00E5FF] hover:text-[#050505] transition-all active:scale-95 shadow-[0_4px_15px_rgba(0,229,176,0.1)] group-hover:shadow-[0_4px_20px_rgba(0,229,176,0.25)]"
                      >
                        <Phone className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Reports Preview */}
              <div>
                <div className="text-[11px] font-black dark:text-[#52525b] text-gray-400 uppercase tracking-[0.2em] mb-4 px-1 font-mono flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-[1px] bg-[#52525b]/30" />
                    {t('lbl_recent_lf')}
                  </div>
                  <button onClick={() => setActivePage('lostfound')} className="text-[#0066FF] text-[10px] uppercase tracking-widest hover:underline font-bold">
                    {t('lbl_see_all')}
                  </button>
                </div>
                <div className="space-y-3">
                  {lfItems.filter(item => {
                    const matchesFilter = lfFilter === 'all' || item.type === lfFilter;
                    const matchesSearch = item.title.toLowerCase().includes(lfSearch.toLowerCase()) || 
                                         item.description.toLowerCase().includes(lfSearch.toLowerCase());
                    return matchesFilter && matchesSearch;
                  }).length > 0 ? (
                    lfItems.filter(item => {
                      const matchesFilter = lfFilter === 'all' || item.type === lfFilter;
                      const matchesSearch = item.title.toLowerCase().includes(lfSearch.toLowerCase()) || 
                                           item.description.toLowerCase().includes(lfSearch.toLowerCase());
                      return matchesFilter && matchesSearch;
                    }).slice(0, 2).map((item) => (
                      <div key={item.id} className="bg-gradient-to-br from-[#1a1a1a]/80 to-[#111111]/80 border dark:border-white/5 border-black/5 rounded-[1.5rem] overflow-hidden relative group hover:dark:border-white/10 border-black/10 hover:dark:bg-[#1a1a1a] bg-white transition-all backdrop-blur-md shadow-sm">
                        <div className={cn(
                          "absolute top-0 left-0 w-1.5 h-full transition-opacity opacity-80 group-hover:opacity-100",
                          item.type === 'lost' ? "bg-gradient-to-b from-[#FF4444] to-transparent" : "bg-gradient-to-b from-[#00E5FF] to-transparent"
                        )} />
                        <div className="p-4 pl-5">
                          <div className="flex gap-4">
                            {item.image && (
                              <div className="w-16 h-16 rounded-xl overflow-hidden relative shrink-0 border dark:border-white/10 border-black/10 shadow-inner group-hover:scale-105 transition-transform">
                                <Image src={item.image} alt={item.title} fill className="object-cover" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0 py-0.5">
                              <div className="flex items-start justify-between mb-1.5">
                                <div className={cn(
                                  "text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest shadow-sm border",
                                  item.type === 'lost' ? "bg-[#FF4444]/10 text-[#FF4444] border-[#FF4444]/20" : "bg-[#00E5FF]/10 text-[#00E5FF] border-[#00E5FF]/20"
                                )}>
                                  {item.type === 'lost' ? t('lf_lost') : t('lf_found')}
                                </div>
                              </div>
                              <h3 className="text-sm font-black dark:text-white text-gray-900 mb-1.5 uppercase tracking-tight truncate drop-shadow-sm">{item.title}</h3>
                              <div className="flex items-center gap-3">
                                {item.timeLost && (
                                  <div className="text-[9px] text-[#FFB800] font-bold flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {new Date(item.timeLost).toLocaleString(lang === 'id' ? 'id-ID' : lang === 'fr' ? 'fr-FR' : lang === 'de' ? 'de-DE' : lang === 'es' ? 'es-ES' : 'en-US', { dateStyle: 'short', timeStyle: 'short' })}
                                  </div>
                                )}
                                <div className="flex items-center gap-1 text-[9px] dark:text-[#a1a1aa] text-gray-500 font-bold truncate">
                                  <MapPin className="w-3 h-3 text-[#0066FF] shrink-0" />
                                  <span className="truncate">{item.location}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="bg-gradient-to-br from-[#1a1a1a]/50 to-[#111111]/50 border border-dashed dark:border-white/10 border-black/10 rounded-[1.5rem] p-8 text-center backdrop-blur-sm">
                      <div className="text-[11px] dark:text-[#52525b] text-gray-400 font-black uppercase tracking-widest">{t('lf_empty')}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Safety Tips Section */}
              <div>
                <div className="text-[11px] font-black dark:text-[#52525b] text-gray-400 uppercase tracking-[0.2em] mb-4 px-1 font-mono flex items-center gap-2">
                  <div className="w-8 h-[1px] bg-[#52525b]/30" />
                  {t('lbl_tips')}
                </div>
                <div className="bg-gradient-to-br from-[#1a1a1a]/80 to-[#111111]/80 border dark:border-white/5 border-black/5 rounded-[2rem] overflow-hidden shadow-lg backdrop-blur-md ring-1 ring-white/5">
                  <div className="p-5 bg-gradient-to-r from-white/5 to-transparent flex items-center gap-4 border-b dark:border-white/5 border-black/5">
                    <div className="p-2.5 bg-gradient-to-br from-[#FFB800]/20 to-[#FFB800]/5 rounded-xl border border-[#FFB800]/20 shadow-inner">
                      <AlertCircle className="w-5 h-5 text-[#FFB800] drop-shadow-[0_0_8px_rgba(255,184,48,0.5)]" />
                    </div>
                    <div className="text-sm font-black uppercase tracking-wider dark:text-white text-gray-900 drop-shadow-sm">{t('tips_title')}</div>
                  </div>
                  <div className="divide-y divide-white/5">
                    {getDynamicTips().slice(0, 3).map((tip, i) => (
                      <motion.div 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        key={i} 
                        className="p-5 flex items-start gap-4 hover:bg-white/[0.03] transition-colors group"
                      >
                        <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-[#00E5FF] to-[#00b388] mt-1 shrink-0 shadow-[0_0_10px_rgba(0,229,176,0.6)] group-hover:scale-125 transition-transform" />
                        <div className="text-xs dark:text-[#a1a1aa] text-gray-500 leading-relaxed font-bold group-hover:dark:text-white text-gray-900 transition-colors">{tip}</div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>

              {deferredPrompt && (
                <button 
                  onClick={handleInstall}
                  className="w-full bg-gradient-to-r from-[#00E5FF] to-[#0066FF] p-4 rounded-2xl dark:text-white text-gray-900 font-black text-sm shadow-xl shadow-emerald-900/20 flex items-center justify-center gap-2"
                >
                  📥 {t('pwa_title')}
                </button>
              )}
            </motion.div>
          )}

          {/* PAGE: KONTAK */}
          {activePage === 'kontak' && (
            <motion.div key="kontak" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
              <div className="bg-gradient-to-br from-[#FF4444] to-[#CC0000] rounded-[2.5rem] p-8 shadow-[0_20px_50px_rgba(255,60,60,0.4)] relative overflow-hidden ring-1 ring-[#FF4444]/50 group">
                <div className="absolute -right-10 -top-10 w-56 h-56 dark:bg-white/20 bg-black/20 rounded-full blur-3xl group-hover:bg-white/30 transition-colors duration-500" />
                <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-black/20 rounded-full blur-2xl" />
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-8">
                    <div className="w-16 h-16 dark:bg-white/20 bg-black/20 rounded-[1.5rem] flex items-center justify-center backdrop-blur-md shadow-inner border border-white/30 group-hover:scale-110 transition-transform duration-500">
                      <Phone className="w-8 h-8 dark:text-white text-gray-900 drop-shadow-md" />
                    </div>
                    <div className="text-[11px] font-black dark:text-white text-gray-900 uppercase tracking-[0.3em] drop-shadow-sm bg-black/10 px-3 py-1.5 rounded-full backdrop-blur-sm border dark:border-white/10 border-black/10">{t('sent_title')}</div>
                  </div>
                  <div className="text-7xl font-black dark:text-white text-gray-900 mb-4 tracking-tighter drop-shadow-xl">112</div>
                  <p className="text-xs dark:text-white text-gray-900 font-bold leading-relaxed mb-8 max-w-[260px] drop-shadow-sm">{t('emg_txt')}</p>
                  <button 
                    onClick={() => makeCall('112')}
                    className="w-full bg-white text-[#FF4444] py-4 rounded-2xl font-black text-sm uppercase tracking-[0.2em] shadow-[0_10px_25px_rgba(0,0,0,0.3)] active:scale-95 hover:bg-gray-50 transition-all flex items-center justify-center gap-3 group/btn"
                  >
                    <Phone className="w-5 h-5 group-hover/btn:animate-pulse" />
                    {t('m_call')}
                  </button>
                </div>
              </div>

              <div className="space-y-8">
                {/* Nearby Medical Quick View */}
                <div>
                  <div className="text-[11px] font-black dark:text-[#a1a1aa] text-gray-500 uppercase tracking-[0.2em] mb-4 px-1 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#FF4444] animate-pulse shadow-[0_0_8px_rgba(255,60,60,0.8)]" />
                    {t('lbl_nearby_med')}
                  </div>
                  <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar -mx-5 px-5">
                    {EMERGENCY_CONTACTS.filter(c => c.type === 'med').slice(0, 3).map((c, i) => (
                      <button 
                        key={i}
                        onClick={() => makeCall(c.num)}
                        className="bg-gradient-to-br from-[#1a1a1a]/90 to-[#111111]/90 border dark:border-white/10 border-black/10 rounded-[1.5rem] p-5 min-w-[170px] flex flex-col items-start gap-4 active:scale-95 hover:border-[#0066FF]/40 hover:shadow-[0_8px_25px_rgba(61,155,255,0.15)] transition-all ring-1 ring-white/5 backdrop-blur-md group"
                      >
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-white/5 to-transparent flex items-center justify-center text-2xl shadow-inner border dark:border-white/5 border-black/5 group-hover:scale-110 transition-transform">
                          {c.icon}
                        </div>
                        <div className="text-left w-full">
                          <div className="text-xs font-black dark:text-white text-gray-900 uppercase tracking-tight truncate w-full mb-1.5 drop-shadow-sm">{c.name}</div>
                          <div className="text-[11px] text-[#0066FF] font-bold font-mono tracking-widest flex items-center gap-1.5">
                            <Phone className="w-3 h-3" />
                            {c.num}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Medical */}
                <div>
                  <div className="text-[11px] font-black dark:text-[#a1a1aa] text-gray-500 uppercase tracking-[0.2em] mb-4 px-1 flex items-center gap-2">
                    <span className="text-base drop-shadow-sm">🏥</span> {t('lbl_med')}
                  </div>
                  <div className="space-y-3">
                    {EMERGENCY_CONTACTS.filter(c => c.type === 'med').map((c, i) => (
                      <ContactCard key={i} c={c} t={t} lang={lang} />
                    ))}
                  </div>
                </div>

                {/* Police & Fire */}
                <div className="grid grid-cols-1 gap-8">
                  <div>
                    <div className="text-[11px] font-black dark:text-[#a1a1aa] text-gray-500 uppercase tracking-[0.2em] mb-4 px-1 flex items-center gap-2">
                      <span className="text-base drop-shadow-sm">👮</span> {t('lbl_pol')}
                    </div>
                    <div className="space-y-3">
                      {EMERGENCY_CONTACTS.filter(c => c.type === 'pol').map((c, i) => (
                        <ContactCard key={i} c={c} t={t} lang={lang} />
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-black dark:text-[#a1a1aa] text-gray-500 uppercase tracking-[0.2em] mb-4 px-1 flex items-center gap-2">
                      <span className="text-base drop-shadow-sm">🚒</span> {t('lbl_fire')}
                    </div>
                    <div className="space-y-3">
                      {EMERGENCY_CONTACTS.filter(c => c.type === 'fire').map((c, i) => (
                        <ContactCard key={i} c={c} t={t} lang={lang} />
                      ))}
                    </div>
                  </div>
                </div>

                {/* SAR */}
                <div>
                  <div className="text-[11px] font-black dark:text-[#a1a1aa] text-gray-500 uppercase tracking-[0.2em] mb-4 px-1 flex items-center gap-2">
                    <span className="text-base drop-shadow-sm">⚓</span> {t('lbl_sar')}
                  </div>
                  <div className="space-y-3">
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
            <motion.div key="peta" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
              <div className="bg-gradient-to-br from-[#1a1a1a] to-[#111111] border dark:border-white/5 border-black/5 rounded-[2rem] overflow-hidden shadow-xl ring-1 ring-white/5 relative">
                <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />
                <div className="p-5 bg-white/[0.02] flex items-center justify-between border-b dark:border-white/5 border-black/5 relative z-10 backdrop-blur-sm">
                  <div className="text-sm font-black dark:text-white text-gray-900 tracking-tight flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0066FF]/20 to-[#0055CC]/20 flex items-center justify-center border border-[#0066FF]/30 shadow-inner">
                      <MapPin className="w-4 h-4 text-[#0066FF] drop-shadow-sm" />
                    </div>
                    {t('lbl_about_gili')}
                  </div>
                </div>
                {/* Map Filters */}
                <div className="px-5 py-4 dark:bg-[#050505] bg-gray-50 flex gap-3 overflow-x-auto no-scrollbar border-b dark:border-white/5 border-black/5 relative z-10">
                  {[
                    { id: '', label: t('lbl_my_loc'), icon: '📍' },
                    { id: 'Klinik Gili Trawangan', label: 'Klinik', icon: '🏥' },
                    { id: 'Polisi Gili Trawangan', label: 'Polisi', icon: '👮' },
                    { id: 'Apotek Gili Trawangan', label: 'Apotek', icon: '💊' },
                    { id: 'Pelabuhan Gili Trawangan', label: 'Pelabuhan', icon: '⚓' },
                  ].map(filter => (
                    <button
                      key={filter.id}
                      onClick={() => setMapQuery(filter.id)}
                      className={cn(
                        "whitespace-nowrap px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-2.5 border shadow-sm",
                        mapQuery === filter.id 
                          ? "bg-gradient-to-r from-[#0066FF] to-[#0055CC] text-white border-[#0066FF]/50 shadow-[0_4px_15px_rgba(61,155,255,0.3)]" 
                          : "dark:bg-white/5 bg-black/5 dark:text-[#a1a1aa] text-gray-500 dark:border-white/5 border-black/5 hover:dark:bg-white/10 bg-black/10 hover:dark:text-white text-gray-900"
                      )}
                    >
                      <span className="text-sm drop-shadow-sm">{filter.icon}</span>
                      {filter.label}
                    </button>
                  ))}
                </div>
                <div className="aspect-square relative dark:bg-[#050505] bg-gray-50 flex items-center justify-center overflow-hidden">
                  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 mix-blend-overlay pointer-events-none" />
                  <iframe 
                    src={`https://maps.google.com/maps?q=${mapQuery || (coords === '--' ? 'Gili Trawangan, NTB' : coords)}&z=15&output=embed`}
                    width="100%" 
                    height="100%" 
                    style={{ border: 0 }} 
                    allowFullScreen 
                    loading="lazy" 
                    referrerPolicy="no-referrer-when-downgrade"
                    className="absolute inset-0 grayscale-[20%] contrast-[1.1] brightness-[0.9]"
                  />
                  {!mapQuery && (
                    <div className="absolute bottom-6 left-6 right-6 flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-[#111111]/95 to-[#050505]/95 backdrop-blur-xl rounded-[1.5rem] border dark:border-white/10 border-black/10 shadow-[0_20px_40px_rgba(0,0,0,0.6)] pointer-events-none ring-1 ring-white/5">
                      <div className="text-[10px] font-black mb-2 dark:text-[#a1a1aa] text-gray-500 uppercase tracking-[0.2em]">{t('lbl_your_loc')}</div>
                      <div className="text-sm text-[#00E5FF] font-mono font-bold mb-5 px-5 py-2 rounded-xl bg-[#00E5FF]/10 border border-[#00E5FF]/20 shadow-inner tracking-wider">{coords}</div>
                      <button 
                        onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${coords}`, '_blank')}
                        className="bg-gradient-to-r from-[#0066FF] to-[#0055CC] text-white px-6 py-4 rounded-xl text-[11px] font-black uppercase tracking-widest shadow-[0_8px_25px_rgba(61,155,255,0.3)] active:scale-95 hover:shadow-[0_8px_30px_rgba(61,155,255,0.5)] transition-all pointer-events-auto w-full flex items-center justify-center gap-3 border border-[#0066FF]/50"
                      >
                        <Navigation className="w-4 h-4 drop-shadow-sm" />
                        {t('lbl_open_maps')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-8">
                <button 
                  onClick={() => setMapQuery('Pelabuhan Gili Trawangan')}
                  className="bg-gradient-to-br from-[#1a1a1a]/80 to-[#111111]/80 border dark:border-white/5 border-black/5 rounded-2xl p-5 text-left hover:border-[#0066FF]/40 hover:shadow-lg transition-all active:scale-95 ring-1 ring-white/5 group backdrop-blur-sm relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-[#0066FF]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="text-[10px] dark:text-[#a1a1aa] text-gray-500 font-black uppercase mb-2 tracking-[0.2em] group-hover:text-[#0066FF] transition-colors relative z-10">{t('lbl_evac_point')}</div>
                  <div className="text-sm font-black dark:text-white text-gray-900 mb-1 drop-shadow-sm relative z-10">{t('lbl_main_harbor')}</div>
                  <div className="text-[11px] dark:text-[#a1a1aa] text-gray-500 font-medium relative z-10">{t('lbl_east_side')}</div>
                </button>
                <button 
                  onClick={() => setMapQuery('Klinik Gili Trawangan')}
                  className="bg-gradient-to-br from-[#1a1a1a]/80 to-[#111111]/80 border dark:border-white/5 border-black/5 rounded-2xl p-5 text-left hover:border-[#0066FF]/40 hover:shadow-lg transition-all active:scale-95 ring-1 ring-white/5 group backdrop-blur-sm relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-[#00E5FF]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="text-[10px] dark:text-[#a1a1aa] text-gray-500 font-black uppercase mb-2 tracking-[0.2em] group-hover:text-[#00E5FF] transition-colors relative z-10">{t('lbl_nearby_med')}</div>
                  <div className="text-sm font-black dark:text-white text-gray-900 mb-1 drop-shadow-sm relative z-10">{t('lbl_gili_center')}</div>
                  <div className="text-[11px] dark:text-[#a1a1aa] text-gray-500 font-medium relative z-10">{t('lbl_near_art')}</div>
                </button>
              </div>

              <div className="space-y-4">
                <div className="text-[11px] font-black dark:text-[#a1a1aa] text-gray-500 uppercase tracking-[0.2em] px-2 flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full dark:bg-white/5 bg-black/5 flex items-center justify-center border dark:border-white/10 border-black/10 shadow-inner">
                    <span className="text-xs drop-shadow-sm">📍</span>
                  </div>
                  {t('q3')}
                </div>
                <div className="space-y-3">
                  {[
                    { name: 'Gili Trawangan Harbor', type: 'Transport', dist: '200m', icon: '⚓' },
                    { name: 'Warna Beach Club', type: 'Resto', dist: '450m', icon: '🍹' },
                    { name: 'Villa Almarik', type: 'Hotel', dist: '1.2km', icon: '🏨' },
                    { name: 'Blue Marlin Dive', type: 'Dive', dist: '300m', icon: '🤿' },
                  ].map((f, i) => (
                    <div 
                      key={i} 
                      onClick={() => setMapQuery(f.name)}
                      className="bg-gradient-to-br from-[#1a1a1a]/80 to-[#111111]/80 border dark:border-white/5 border-black/5 rounded-[1.5rem] p-4 flex items-center justify-between group cursor-pointer hover:dark:bg-[#1a1a1a] bg-white hover:dark:border-white/10 border-black/10 active:scale-[0.98] transition-all backdrop-blur-md shadow-sm hover:shadow-md ring-1 ring-white/5"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-gradient-to-br from-white/5 to-transparent rounded-2xl flex items-center justify-center text-3xl group-hover:scale-110 transition-transform shadow-inner border dark:border-white/5 border-black/5">{f.icon}</div>
                        <div>
                          <div className="text-sm font-black dark:text-white text-gray-900 tracking-tight mb-1 drop-shadow-sm">{f.name}</div>
                          <div className="text-[10px] dark:text-[#a1a1aa] text-gray-500 font-bold uppercase tracking-widest opacity-90 flex items-center gap-1.5">
                            {f.type} <span className="dark:text-white text-gray-900">•</span> <span className="text-[#0066FF]">{f.dist}</span>
                          </div>
                        </div>
                      </div>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(`https://www.google.com/maps/search/${encodeURIComponent(f.name)}`, '_blank');
                        }}
                        className="w-12 h-12 dark:bg-white/5 bg-black/5 rounded-xl flex items-center justify-center text-[#0066FF] group-hover:bg-[#0066FF] group-hover:dark:text-white text-gray-900 transition-all shadow-sm border dark:border-white/5 border-black/5"
                      >
                        <Navigation className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* PAGE: P3K */}
          {activePage === 'p3k' && (
            <motion.div key="p3k" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
              {!showAiChat ? (
                <>
                  <div className="flex flex-col gap-3 mb-6">
                    <div className="flex gap-3">
                      <div className="relative flex-1 group">
                        <div className="absolute inset-0 bg-gradient-to-r from-[#0066FF]/20 to-[#00E5FF]/20 rounded-2xl blur-md opacity-0 group-focus-within:opacity-100 transition-opacity" />
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 dark:text-[#52525b] text-gray-400 group-focus-within:text-[#0066FF] transition-colors z-10" />
                        <input 
                          type="text"
                          placeholder={t('lbl_search_p3k')}
                          value={p3kSearch}
                          onChange={(e) => setP3kSearch(e.target.value)}
                          className="w-full dark:bg-[#1a1a1a] bg-white border dark:border-white/10 border-black/10 rounded-2xl py-3.5 pl-11 pr-4 text-xs dark:text-white text-gray-900 placeholder-[#52525b] focus:outline-none focus:border-[#0066FF]/50 transition-all relative z-10 backdrop-blur-md shadow-inner"
                        />
                      </div>
                      <button
                        onClick={() => setShowAiChat(true)}
                        className="bg-gradient-to-br from-[#0066FF] to-[#0055CC] text-white px-5 rounded-2xl flex items-center justify-center shadow-[0_8px_20px_rgba(61,155,255,0.3)] hover:shadow-[0_8px_25px_rgba(61,155,255,0.5)] active:scale-95 transition-all border dark:border-white/10 border-black/10 relative overflow-hidden group"
                      >
                        <div className="absolute inset-0 dark:bg-white/20 bg-black/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                        <MessageSquare className="w-5 h-5 relative z-10 drop-shadow-sm" />
                      </button>
                    </div>

                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                      {[
                        { id: 'ALL', label: t('cat_all') },
                        { id: 'KRITIS', label: t('cat_kritis') },
                        { id: 'LAUT', label: t('cat_laut') },
                        { id: 'SEDANG', label: t('cat_sedang') },
                        { id: 'SERIUS', label: t('cat_serius') },
                        { id: 'DARAT', label: t('cat_darat') },
                        { id: 'UMUM', label: t('cat_umum') },
                        { id: 'HEWAN', label: t('cat_hewan') },
                      ].map((cat) => (
                        <button
                          key={cat.id}
                          onClick={() => setP3kCategory(cat.id)}
                          className={cn(
                            "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border active:scale-95",
                            p3kCategory === cat.id
                              ? "bg-[#0066FF] border-[#0066FF] text-white shadow-[0_4px_12px_rgba(0,102,255,0.3)]"
                              : "dark:bg-white/5 bg-black/5 dark:border-white/5 border-black/5 dark:text-[#a1a1aa] text-gray-500 hover:dark:bg-white/10 bg-black/10"
                          )}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    {P3K_GUIDES.filter(guide => {
                      const matchesSearch = guide.title[lang].toLowerCase().includes(p3kSearch.toLowerCase()) ||
                        guide.tags.some(tag => tag.toLowerCase().includes(p3kSearch.toLowerCase()));
                      const matchesCategory = p3kCategory === 'ALL' || guide.tags.includes(p3kCategory);
                      return matchesSearch && matchesCategory;
                    }).map((guide) => {
                      const isExpanded = expandedGuide === guide.id;
                      return (
                        <div key={guide.id} className="bg-gradient-to-br from-[#1a1a1a]/80 to-[#111111]/80 border dark:border-white/5 border-black/5 rounded-[1.5rem] overflow-hidden backdrop-blur-md shadow-lg ring-1 ring-white/5 transition-all">
                          <div 
                            onClick={() => setExpandedGuide(isExpanded ? null : guide.id)}
                            className="p-5 bg-gradient-to-r from-white/5 to-transparent flex items-center justify-between cursor-pointer group"
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 dark:bg-white/5 bg-black/5 rounded-2xl flex items-center justify-center text-2xl shadow-inner border dark:border-white/5 border-black/5 group-hover:scale-110 transition-transform">{guide.icon}</div>
                              <div>
                                <div className="text-sm font-black dark:text-white text-gray-900 tracking-tight drop-shadow-sm">{guide.title[lang]}</div>
                                <div className="flex flex-wrap gap-1.5 mt-1.5">
                                  {guide.tags.map(tag => (
                                    <span key={tag} className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md dark:bg-white/5 bg-black/5 dark:text-[#a1a1aa] text-gray-500 border dark:border-white/5 border-black/5 shadow-sm">{tag}</span>
                                  ))}
                                </div>
                              </div>
                            </div>
                            <motion.div
                              animate={{ rotate: isExpanded ? 180 : 0 }}
                              className="w-8 h-8 rounded-full dark:bg-white/5 bg-black/5 flex items-center justify-center dark:text-[#a1a1aa] text-gray-500"
                            >
                              <ChevronDown className="w-4 h-4" />
                            </motion.div>
                          </div>
                          
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.3, ease: 'easeInOut' }}
                              >
                                <div className="p-5 pt-0 space-y-2.5 border-t dark:border-white/5 border-black/5">
                                  {guide.steps.map((step, i) => {
                                    const isCompleted = completedTasks.includes(step.id);
                                    return (
                                      <motion.div 
                                        key={step.id} 
                                        className={cn(
                                          "flex gap-4 cursor-pointer p-3 rounded-xl transition-all border",
                                          isCompleted ? "bg-[#00E5FF]/10 border-[#00E5FF]/20 shadow-inner" : "bg-white/[0.02] border-transparent hover:dark:bg-white/5 bg-black/5 hover:dark:border-white/5 border-black/5"
                                        )}
                                        onClick={() => {
                                          setCompletedTasks(prev => 
                                            prev.includes(step.id) 
                                              ? prev.filter(id => id !== step.id)
                                              : [...prev, step.id]
                                          );
                                        }}
                                        layout
                                      >
                                        <motion.div 
                                          className={cn(
                                            "w-6 h-6 rounded-full border flex items-center justify-center text-[10px] font-black shrink-0 transition-all shadow-sm",
                                            isCompleted ? "bg-[#00E5FF] border-[#00E5FF] text-[#050505] shadow-[0_0_10px_rgba(0,229,176,0.4)]" : "dark:bg-[#111111] bg-white dark:border-white/10 border-black/10 dark:text-white text-gray-900"
                                          )}
                                          animate={isCompleted ? { scale: [1, 1.2, 1] } : { scale: 1 }}
                                          transition={{ duration: 0.3 }}
                                        >
                                          {isCompleted ? <CheckCircle2 className="w-3.5 h-3.5" /> : i+1}
                                        </motion.div>
                                        <motion.div 
                                          className={cn(
                                            "text-xs leading-relaxed transition-all font-medium py-0.5",
                                            isCompleted ? "text-[#00E5FF]/80 line-through decoration-[#00E5FF]/40" : "dark:text-[#a1a1aa] text-gray-500"
                                          )}
                                          animate={isCompleted ? { opacity: 0.8 } : { opacity: 1 }}
                                        >
                                          {step.text[lang]}
                                        </motion.div>
                                      </motion.div>
                                    );
                                  })}
                                  <div className="bg-gradient-to-r from-[#FFB800]/10 to-transparent border border-[#FFB800]/20 rounded-xl p-4 text-[11px] text-[#FFB800] flex gap-3 mt-4 items-start shadow-inner">
                                    <span className="text-base drop-shadow-sm">⚠️</span>
                                    <span className="font-medium leading-relaxed">{guide.warning[lang]}</span>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="flex flex-col h-[65vh] bg-gradient-to-br from-[#1a1a1a]/90 to-[#111111]/90 border dark:border-white/10 border-black/10 rounded-[2rem] overflow-hidden backdrop-blur-md shadow-2xl ring-1 ring-white/5">
                  <div className="p-5 bg-gradient-to-r from-white/5 to-transparent border-b dark:border-white/5 border-black/5 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0066FF] to-[#00E5FF] flex items-center justify-center shadow-inner border dark:border-white/20 border-black/20">
                        <HeartPulse className="w-5 h-5 dark:text-white text-gray-900 drop-shadow-md" />
                      </div>
                      <div>
                        <div className="text-sm font-black dark:text-white text-gray-900 tracking-tight drop-shadow-sm">{t('ai_title')}</div>
                        <div className="text-[10px] dark:text-[#a1a1aa] text-gray-500 font-medium">{t('ai_disclaimer')}</div>
                      </div>
                    </div>
                    <button onClick={() => setShowAiChat(false)} className="w-10 h-10 rounded-xl dark:bg-white/5 bg-black/5 flex items-center justify-center dark:text-[#a1a1aa] text-gray-500 hover:dark:text-white text-gray-900 hover:dark:bg-white/10 bg-black/10 transition-all active:scale-95 border dark:border-white/5 border-black/5">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-5 space-y-5 no-scrollbar">
                    {aiMessages.length === 0 && (
                      <div className="text-center dark:text-[#a1a1aa] text-gray-500 text-xs mt-12 font-medium bg-white/[0.02] py-6 px-4 rounded-2xl border border-dashed dark:border-white/10 border-black/10">
                        {t('ai_prompt_hint')}
                      </div>
                    )}
                    {aiMessages.map((msg, i) => (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        key={i} 
                        className={cn("flex", msg.role === 'user' ? "justify-end" : "justify-start")}
                      >
                        <div className={cn(
                          "max-w-[85%] rounded-[1.5rem] p-4 text-xs leading-relaxed shadow-md",
                          msg.role === 'user' 
                            ? "bg-gradient-to-br from-[#0066FF] to-[#0055CC] text-white rounded-tr-sm border border-[#0066FF]/50" 
                            : "bg-gradient-to-br from-[#1a1a1a] to-[#1a1a1a] dark:text-[#ffffff] text-gray-900 border dark:border-white/10 border-black/10 rounded-tl-sm"
                        )}>
                          {msg.role === 'user' ? (
                            <span className="font-medium drop-shadow-sm">{msg.text}</span>
                          ) : (
                            <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-black/40 prose-pre:border prose-pre:dark:border-white/10 border-black/10 prose-a:text-[#0066FF] prose-strong:dark:text-white text-gray-900 prose-strong:font-black">
                              <ReactMarkdown>{msg.text}</ReactMarkdown>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                    {isAiLoading && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                        <div className="bg-gradient-to-br from-[#1a1a1a] to-[#1a1a1a] border dark:border-white/10 border-black/10 rounded-[1.5rem] rounded-tl-sm p-4 flex gap-1.5 shadow-md">
                          <div className="w-2 h-2 bg-[#0066FF] rounded-full animate-bounce shadow-[0_0_8px_rgba(61,155,255,0.6)]" />
                          <div className="w-2 h-2 bg-[#00E5FF] rounded-full animate-bounce shadow-[0_0_8px_rgba(0,229,176,0.6)]" style={{ animationDelay: '0.15s' }} />
                          <div className="w-2 h-2 bg-[#0066FF] rounded-full animate-bounce shadow-[0_0_8px_rgba(61,155,255,0.6)]" style={{ animationDelay: '0.3s' }} />
                        </div>
                      </motion.div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                  
                  <div className="bg-gradient-to-r from-[#FFB800]/10 to-transparent border-t border-[#FFB800]/20 p-3 text-center shadow-inner">
                    <p className="text-[10px] text-[#FFB800] leading-relaxed font-bold flex items-center justify-center gap-2">
                      <span className="text-sm drop-shadow-sm">⚠️</span>
                      {t('ai_warning')}
                    </p>
                  </div>

                  <form onSubmit={handleAiSubmit} className="p-4 bg-white/[0.02] border-t dark:border-white/10 border-black/10 flex gap-3 backdrop-blur-sm">
                    <input 
                      type="text"
                      value={aiInput}
                      onChange={e => setAiInput(e.target.value)}
                      placeholder={t('ai_placeholder')}
                      className="flex-1 dark:bg-[#050505] bg-gray-50 border dark:border-white/10 border-black/10 rounded-2xl px-5 py-3.5 text-xs dark:text-white text-gray-900 placeholder-[#52525b] focus:outline-none focus:border-[#0066FF]/50 shadow-inner transition-all"
                    />
                    <button 
                      type="submit"
                      disabled={!aiInput.trim() || isAiLoading}
                      className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#0066FF] to-[#0055CC] text-white flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_8px_20px_rgba(61,155,255,0.3)] hover:shadow-[0_8px_25px_rgba(61,155,255,0.5)] active:scale-95 transition-all border border-[#0066FF]/50"
                    >
                      <Navigation className="w-5 h-5 rotate-90 drop-shadow-sm" />
                    </button>
                  </form>
                </div>
              )}
            </motion.div>
          )}

          {/* PAGE: LOST & FOUND */}
          {activePage === 'lostfound' && (
            <motion.div key="lostfound" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2 dark:bg-white/5 bg-black/5 p-1 rounded-full border dark:border-white/10 border-black/10 shadow-inner">
                  <button 
                    onClick={() => setLfFilter('all')}
                    className={cn(
                      "px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all",
                      lfFilter === 'all' ? "bg-gradient-to-r from-[#0066FF] to-[#0055CC] text-white shadow-md" : "dark:text-[#a1a1aa] text-gray-500 hover:dark:text-white text-gray-900"
                    )}
                  >
                    {t('lbl_all')}
                  </button>
                  <button 
                    onClick={() => setLfFilter('lost')}
                    className={cn(
                      "px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all",
                      lfFilter === 'lost' ? "bg-gradient-to-r from-[#FF4444] to-[#CC0000] text-white shadow-md" : "dark:text-[#a1a1aa] text-gray-500 hover:dark:text-white text-gray-900"
                    )}
                  >
                    {t('lf_lost')}
                  </button>
                  <button 
                    onClick={() => setLfFilter('found')}
                    className={cn(
                      "px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all",
                      lfFilter === 'found' ? "bg-gradient-to-r from-[#00E5FF] to-[#00b388] dark:text-white text-gray-900 shadow-md" : "dark:text-[#a1a1aa] text-gray-500 hover:dark:text-white text-gray-900"
                    )}
                  >
                    {t('lf_found')}
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  {user && (
                    <button 
                      onClick={handleLogout}
                      className="text-[9px] font-black dark:text-[#a1a1aa] text-gray-500 uppercase tracking-widest dark:bg-white/5 bg-black/5 hover:dark:bg-white/10 bg-black/10 px-4 py-2.5 rounded-xl border dark:border-white/10 border-black/10 transition-colors"
                    >
                      {t('lf_logout')}
                    </button>
                  )}
                  <button 
                    id="btn-report-lf"
                    onClick={() => user ? setShowLfForm(true) : handleGoogleLogin()}
                    className="bg-gradient-to-br from-[#0066FF] to-[#0055CC] text-white p-2.5 rounded-xl shadow-[0_8px_20px_rgba(61,155,255,0.3)] hover:shadow-[0_8px_25px_rgba(61,155,255,0.5)] active:scale-95 transition-all border border-[#0066FF]/50"
                  >
                    <Plus className="w-5 h-5 drop-shadow-sm" />
                  </button>
                </div>
              </div>

              <div className="relative mb-8 group">
                <div className="absolute inset-0 bg-gradient-to-r from-[#0066FF]/20 to-[#00E5FF]/20 rounded-2xl blur-md opacity-0 group-focus-within:opacity-100 transition-opacity" />
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 dark:text-[#52525b] text-gray-400 group-focus-within:text-[#0066FF] transition-colors z-10" />
                <input 
                  type="text"
                  placeholder={t('lbl_search_lf')}
                  value={lfSearch}
                  onChange={(e) => setLfSearch(e.target.value)}
                  className="w-full dark:bg-[#1a1a1a] bg-white border dark:border-white/10 border-black/10 rounded-2xl py-3.5 pl-11 pr-4 text-xs dark:text-white text-gray-900 placeholder-[#52525b] focus:outline-none focus:border-[#0066FF]/50 transition-all relative z-10 backdrop-blur-md shadow-inner"
                />
              </div>

              {!user && (
                <div className="bg-gradient-to-br from-[#1a1a1a]/80 to-[#111111]/80 border border-[#0066FF]/30 rounded-[2rem] p-8 text-center mb-8 relative overflow-hidden backdrop-blur-md shadow-lg">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#0066FF] to-[#00E5FF]" />
                  <div className="w-16 h-16 bg-gradient-to-br from-[#0066FF]/20 to-[#00E5FF]/20 rounded-2xl flex items-center justify-center text-[#0066FF] mx-auto mb-5 border border-[#0066FF]/30 shadow-inner">
                    <Shield className="w-8 h-8 drop-shadow-md" />
                  </div>
                  <h3 className="text-sm font-black dark:text-white text-gray-900 uppercase tracking-tight mb-3 drop-shadow-sm">{t('lf_login_req')}</h3>
                  <button 
                    onClick={handleGoogleLogin}
                    className="bg-white text-[#050505] px-8 py-3.5 rounded-xl text-[11px] font-black uppercase tracking-widest shadow-[0_10px_25px_rgba(255,255,255,0.2)] flex items-center gap-3 mx-auto active:scale-95 hover:bg-gray-50 transition-all"
                  >
                    <Image src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width={18} height={18} alt="Google" />
                    {t('lf_login_btn')}
                  </button>
                </div>
              )}

              {lfLoading ? (
                <div className="flex justify-center py-24">
                  <RefreshCw className="w-10 h-10 text-[#0066FF] animate-spin drop-shadow-[0_0_15px_rgba(61,155,255,0.5)]" />
                </div>
              ) : lfItems.filter(item => {
                const matchesFilter = lfFilter === 'all' || item.type === lfFilter;
                const matchesSearch = item.title.toLowerCase().includes(lfSearch.toLowerCase()) || 
                                     item.description.toLowerCase().includes(lfSearch.toLowerCase());
                return matchesFilter && matchesSearch;
              }).length === 0 ? (
                <div className="bg-gradient-to-br from-[#1a1a1a]/50 to-[#111111]/50 border border-dashed dark:border-white/10 border-black/10 rounded-[2rem] p-16 text-center backdrop-blur-sm">
                  <div className="text-5xl mb-5 opacity-20 drop-shadow-md">📦</div>
                  <div className="text-xs font-black dark:text-[#52525b] text-gray-400 uppercase tracking-[0.2em]">{t('lf_empty')}</div>
                </div>
              ) : (
                <div className="space-y-5">
                  {lfItems
                    .filter(item => {
                      const matchesFilter = lfFilter === 'all' || item.type === lfFilter;
                      const matchesSearch = item.title.toLowerCase().includes(lfSearch.toLowerCase()) || 
                                           item.description.toLowerCase().includes(lfSearch.toLowerCase());
                      return matchesFilter && matchesSearch;
                    })
                    .map((item) => (
                    <motion.div 
                      layout
                      key={item.id}
                      className="bg-gradient-to-br from-[#1a1a1a]/80 to-[#111111]/80 border dark:border-white/5 border-black/5 rounded-[1.5rem] overflow-hidden relative group backdrop-blur-md shadow-lg ring-1 ring-white/5"
                    >
                      <div className={cn(
                        "absolute top-0 left-0 w-1.5 h-full transition-opacity opacity-80 group-hover:opacity-100",
                        item.type === 'lost' ? "bg-gradient-to-b from-[#FF4444] to-transparent" : "bg-gradient-to-b from-[#00E5FF] to-transparent"
                      )} />
                      <div className="p-4 pl-5">
                        <div className="flex gap-4">
                          {item.image && (
                            <div className="w-24 h-24 rounded-xl overflow-hidden relative shrink-0 border dark:border-white/10 border-black/10 shadow-inner group-hover:scale-105 transition-transform">
                              <Image src={item.image} alt={item.title} fill className="object-cover" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0 py-0.5">
                            <div className="flex items-start justify-between mb-2">
                              <div className={cn(
                                "text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest shadow-sm border",
                                item.type === 'lost' ? "bg-[#FF4444]/10 text-[#FF4444] border-[#FF4444]/20" : "bg-[#00E5FF]/10 text-[#00E5FF] border-[#00E5FF]/20"
                              )}>
                                {item.type === 'lost' ? t('lf_lost') : t('lf_found')}
                              </div>
                              {user?.uid === item.uid && (
                                <button 
                                  onClick={() => deleteLfItem(item.id)}
                                  className="p-1.5 text-[#FF4444] hover:bg-[#FF4444]/20 rounded-lg transition-colors border border-transparent hover:border-[#FF4444]/30"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                            <h3 className="text-base font-black dark:text-white text-gray-900 mb-1.5 uppercase tracking-tight truncate drop-shadow-sm">{item.title}</h3>
                            {item.timeLost && (
                              <div className="text-[10px] text-[#FFB800] font-bold mb-1.5 flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5" />
                                {new Date(item.timeLost).toLocaleString(lang === 'id' ? 'id-ID' : lang === 'fr' ? 'fr-FR' : lang === 'de' ? 'de-DE' : lang === 'es' ? 'es-ES' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                              </div>
                            )}
                            <div className="flex items-center gap-1.5 mb-1">
                              <MapPin className="w-3.5 h-3.5 text-[#0066FF] shrink-0" />
                              <span className="text-[11px] dark:text-[#a1a1aa] text-gray-500 font-bold truncate">{item.location}</span>
                            </div>
                          </div>
                        </div>

                        {expandedComments[item.id] && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-4 pt-4 border-t dark:border-white/5 border-black/5">
                            <p className="text-xs dark:text-[#a1a1aa] text-gray-500 leading-relaxed mb-4 font-medium">{item.description}</p>
                            <div className="flex items-center gap-2 mb-5 dark:bg-white/5 bg-black/5 p-2.5 rounded-xl border dark:border-white/5 border-black/5 w-fit">
                              <MessageSquare className="w-4 h-4 text-[#00E5FF]" />
                              <span className="text-[11px] dark:text-white text-gray-900 font-bold truncate">{item.contact}</span>
                            </div>

                            {/* Comments Section */}
                            <div className="space-y-3 mb-4">
                              {item.comments?.map(comment => (
                                <div key={comment.id} className="bg-gradient-to-br from-white/5 to-transparent rounded-xl p-3.5 border dark:border-white/5 border-black/5 shadow-sm">
                                  <div className="flex items-center justify-between mb-1.5">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] font-black dark:text-white text-gray-900 uppercase tracking-wider">{comment.authorName}</span>
                                      {user?.uid === comment.authorUid && (
                                        <button 
                                          onClick={() => setEditingComment({ itemId: item.id, commentId: comment.id, text: comment.text })}
                                          className="text-[#0066FF] hover:text-[#0055CC] transition-colors"
                                        >
                                          <Edit2 className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>
                                    <span className="text-[9px] dark:text-[#a1a1aa] text-gray-500 font-medium">
                                      {new Date(comment.createdAt).toLocaleDateString()}
                                    </span>
                                  </div>
                                  
                                  {editingComment?.commentId === comment.id ? (
                                    <div className="space-y-2">
                                      <textarea 
                                        value={editingComment.text}
                                        onChange={e => setEditingComment({ ...editingComment, text: e.target.value })}
                                        className="w-full bg-black/40 border border-[#0066FF]/30 rounded-lg p-2 text-[11px] dark:text-white text-gray-900 focus:outline-none focus:border-[#0066FF] transition-all resize-none"
                                        rows={2}
                                      />
                                      <div className="flex justify-end gap-2">
                                        <button 
                                          onClick={() => setEditingComment(null)}
                                          className="text-[9px] font-black dark:text-[#a1a1aa] text-gray-500 uppercase tracking-widest px-2 py-1"
                                        >
                                          {t('m_cancel')}
                                        </button>
                                        <button 
                                          onClick={handleEditComment}
                                          disabled={isModerating}
                                          className="bg-[#0066FF] dark:text-white text-gray-900 text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-md shadow-sm flex items-center gap-1"
                                        >
                                          {isModerating && <RefreshCw className="w-2.5 h-2.5 animate-spin" />}
                                          {t('lbl_save')}
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="text-[11px] dark:text-[#a1a1aa] text-gray-500 leading-relaxed font-medium">{comment.text}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                            
                            {user ? (
                              <div className="flex gap-3">
                                <input 
                                  type="text"
                                  value={commentInputs[item.id] || ''}
                                  onChange={e => setCommentInputs(prev => ({...prev, [item.id]: e.target.value}))}
                                  placeholder={t('lbl_write_comment')}
                                  className="flex-1 dark:bg-[#050505] bg-gray-50 border dark:border-white/10 border-black/10 rounded-xl px-4 py-2.5 text-xs dark:text-white text-gray-900 placeholder-[#52525b] focus:outline-none focus:border-[#0066FF]/50 shadow-inner transition-all"
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleAddComment(item.id);
                                    }
                                  }}
                                />
                                <button 
                                  onClick={() => handleAddComment(item.id)}
                                  disabled={!commentInputs[item.id]?.trim() || isModerating}
                                  className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0066FF] to-[#0055CC] text-white flex items-center justify-center disabled:opacity-50 shadow-md border border-[#0066FF]/50 active:scale-95 transition-all"
                                >
                                  {isModerating ? (
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Navigation className="w-4 h-4 rotate-90 drop-shadow-sm" />
                                  )}
                                </button>
                              </div>
                            ) : (
                              <div className="text-center text-[10px] dark:text-[#52525b] text-gray-400 font-bold uppercase tracking-widest bg-white/[0.02] py-3 rounded-xl border border-dashed dark:border-white/10 border-black/10">
                                {t('t_login_comment')}
                              </div>
                            )}
                          </motion.div>
                        )}

                        <button 
                          onClick={() => setExpandedComments(prev => ({...prev, [item.id]: !prev[item.id]}))}
                          className="w-full mt-3 py-2 dark:bg-white/5 bg-black/5 hover:dark:bg-white/10 bg-black/10 rounded-xl text-[10px] font-black dark:text-[#a1a1aa] text-gray-500 uppercase tracking-widest transition-colors flex items-center justify-center gap-2 border dark:border-white/5 border-black/5"
                        >
                          {expandedComments[item.id] ? t('lbl_close_details') : t('lbl_view_details')}
                          {!expandedComments[item.id] && item.comments && item.comments.length > 0 && ` (${item.comments.length})`}
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Delete Confirmation Modal */}
              <AnimatePresence>
                {itemToDelete && (
                  <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="fixed inset-0 dark:bg-[#050505] bg-gray-50 backdrop-blur-md z-[100] flex items-center justify-center p-4"
                    onClick={() => setItemToDelete(null)}
                  >
                    <motion.div 
                      initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }}
                      className="bg-gradient-to-br from-[#1a1a1a] to-[#111111] border dark:border-white/10 border-black/10 rounded-[2rem] p-6 w-full max-w-sm shadow-2xl"
                      onClick={e => e.stopPropagation()}
                    >
                      <div className="flex flex-col items-center text-center mb-6">
                        <div className="w-16 h-16 rounded-full bg-[#FF4444]/10 flex items-center justify-center mb-4 border border-[#FF4444]/20">
                          <Trash2 className="w-8 h-8 text-[#FF4444]" />
                        </div>
                        <h3 className="text-xl font-black dark:text-white text-gray-900 uppercase tracking-tight">{t('lbl_delete_q')}</h3>
                        <p className="text-sm dark:text-[#a1a1aa] text-gray-500 mt-2">{t('lf_delete_confirm')}</p>
                      </div>
                      <div className="flex gap-3">
                        <button 
                          onClick={() => setItemToDelete(null)}
                          className="flex-1 dark:bg-white/5 bg-black/5 hover:dark:bg-white/10 bg-black/10 dark:text-white text-gray-900 font-bold py-3 rounded-xl transition-all border dark:border-white/10 border-black/10"
                        >
                          {t('m_cancel')}
                        </button>
                        <button 
                          onClick={confirmDeleteLfItem}
                          className="flex-1 bg-gradient-to-br from-[#FF4444] to-[#cc0000] text-white font-bold py-3 rounded-xl transition-all shadow-[0_4px_15px_rgba(255,68,68,0.3)] hover:shadow-[0_4px_20px_rgba(255,68,68,0.5)] border border-[#FF4444]/50"
                        >
                          {t('lf_delete_confirm')}
                        </button>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Form Modal */}
              <AnimatePresence>
                {showLfForm && (
                  <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="fixed inset-0 dark:bg-[#050505] bg-gray-50 backdrop-blur-md z-[100] flex items-end justify-center"
                    onClick={() => setShowLfForm(false)}
                  >
                    <motion.div 
                      initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                      transition={{ type: "spring", damping: 25, stiffness: 200 }}
                      className="bg-gradient-to-b from-[#1a1a1a] to-[#111111] w-full max-w-md rounded-t-[2.5rem] border-t dark:border-white/10 border-black/10 p-8 pb-12 overflow-y-auto max-h-[90vh] shadow-[0_-10px_40px_rgba(0,0,0,0.5)]"
                      onClick={e => e.stopPropagation()}
                    >
                      <div className="w-12 h-1.5 dark:bg-white/10 bg-black/10 rounded-full mx-auto mb-8" />
                      <h2 className="text-2xl font-black mb-8 dark:text-white text-gray-900 uppercase tracking-tight drop-shadow-md">{t('lf_form_title')}</h2>
                      
                      <form onSubmit={handleLfSubmit} className="space-y-5">
                        <div>
                          <label className="text-[11px] font-black dark:text-[#a1a1aa] text-gray-500 uppercase tracking-widest mb-3 block">{t('lf_type')}</label>
                          <div className="grid grid-cols-2 gap-3">
                            <button 
                              type="button"
                              onClick={() => setNewLf({...newLf, type: 'lost'})}
                              className={cn(
                                "py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all border shadow-sm",
                                newLf.type === 'lost' ? "bg-gradient-to-br from-[#FF4444] to-[#CC0000] text-white border-[#FF4444]/50 shadow-[0_4px_15px_rgba(255,60,60,0.3)]" : "dark:bg-white/5 bg-black/5 dark:text-[#a1a1aa] text-gray-500 dark:border-white/5 border-black/5 hover:dark:bg-white/10 bg-black/10"
                              )}
                            >{t('lf_lost')}</button>
                            <button 
                              type="button"
                              onClick={() => setNewLf({...newLf, type: 'found'})}
                              className={cn(
                                "py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all border shadow-sm",
                                newLf.type === 'found' ? "bg-gradient-to-br from-[#00E5FF] to-[#00b388] dark:text-white text-gray-900 border-[#00E5FF]/50 shadow-[0_4px_15px_rgba(0,229,176,0.3)]" : "dark:bg-white/5 bg-black/5 dark:text-[#a1a1aa] text-gray-500 dark:border-white/5 border-black/5 hover:dark:bg-white/10 bg-black/10"
                              )}
                            >{t('lf_found')}</button>
                          </div>
                        </div>

                        <div>
                          <label className="text-[11px] font-black dark:text-[#a1a1aa] text-gray-500 uppercase tracking-widest mb-3 block">{t('lf_item_name')}</label>
                          <input 
                            required
                            value={newLf.title}
                            onChange={e => setNewLf({...newLf, title: e.target.value})}
                            className="w-full dark:bg-[#050505] bg-gray-50 border dark:border-white/10 border-black/10 rounded-2xl p-4 text-sm dark:text-white text-gray-900 placeholder-[#52525b] focus:outline-none focus:border-[#0066FF]/50 focus:dark:bg-[#050505] bg-gray-50 transition-all shadow-inner"
                            placeholder="e.g. iPhone 13, Sunglasses"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-black dark:text-[#a1a1aa] text-gray-500 uppercase tracking-widest mb-3 block">{t('lf_item_desc')}</label>
                          <textarea 
                            required
                            rows={3}
                            value={newLf.description}
                            onChange={e => setNewLf({...newLf, description: e.target.value})}
                            className="w-full dark:bg-[#050505] bg-gray-50 border dark:border-white/10 border-black/10 rounded-2xl p-4 text-sm dark:text-white text-gray-900 placeholder-[#52525b] focus:outline-none focus:border-[#0066FF]/50 focus:dark:bg-[#050505] bg-gray-50 transition-all resize-none shadow-inner"
                            placeholder="e.g. Blue case, cracked screen..."
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-black dark:text-[#a1a1aa] text-gray-500 uppercase tracking-widest mb-3 block">{t('lf_item_loc')}</label>
                          <input 
                            required
                            value={newLf.location}
                            onChange={e => setNewLf({...newLf, location: e.target.value})}
                            className="w-full dark:bg-[#050505] bg-gray-50 border dark:border-white/10 border-black/10 rounded-2xl p-4 text-sm dark:text-white text-gray-900 placeholder-[#52525b] focus:outline-none focus:border-[#0066FF]/50 focus:dark:bg-[#050505] bg-gray-50 transition-all shadow-inner"
                            placeholder="e.g. Near Night Market"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-black dark:text-[#a1a1aa] text-gray-500 uppercase tracking-widest mb-3 block">{t('lf_item_contact')}</label>
                          <input 
                            required
                            value={newLf.contact}
                            onChange={e => setNewLf({...newLf, contact: e.target.value})}
                            className="w-full dark:bg-[#050505] bg-gray-50 border dark:border-white/10 border-black/10 rounded-2xl p-4 text-sm dark:text-white text-gray-900 placeholder-[#52525b] focus:outline-none focus:border-[#0066FF]/50 focus:dark:bg-[#050505] bg-gray-50 transition-all shadow-inner"
                            placeholder="e.g. +62 812..."
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-black dark:text-[#a1a1aa] text-gray-500 uppercase tracking-widest mb-3 block">{t('lf_time')}</label>
                          <input 
                            type="datetime-local"
                            value={newLf.timeLost}
                            onChange={e => setNewLf({...newLf, timeLost: e.target.value})}
                            className="w-full dark:bg-[#050505] bg-gray-50 border dark:border-white/10 border-black/10 rounded-2xl p-4 text-sm dark:text-white text-gray-900 focus:outline-none focus:border-[#0066FF]/50 focus:dark:bg-[#050505] bg-gray-50 transition-all [color-scheme:dark] shadow-inner"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-black dark:text-[#a1a1aa] text-gray-500 uppercase tracking-widest mb-3 block">{t('lf_image')}</label>
                          <div className="relative w-full dark:bg-[#050505] bg-gray-50 border-2 border-dashed dark:border-white/10 border-black/10 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 hover:border-[#0066FF]/50 hover:dark:bg-[#050505] bg-gray-50 transition-all cursor-pointer group">
                            <input 
                              type="file"
                              accept="image/*"
                              onChange={handleImageUpload}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            />
                            {newLf.image ? (
                              <div className="relative w-full h-40 rounded-xl overflow-hidden shadow-md">
                                <Image src={newLf.image} alt="Preview" fill className="object-cover" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <span className="dark:text-white text-gray-900 text-xs font-bold uppercase tracking-widest">{t('lbl_change_photo')}</span>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="w-14 h-14 rounded-full dark:bg-white/5 bg-black/5 flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner">
                                  <span className="text-2xl">📷</span>
                                </div>
                                <span className="text-[11px] dark:text-[#a1a1aa] text-gray-500 font-bold uppercase tracking-widest group-hover:dark:text-white text-gray-900 transition-colors">
                                  {t('lbl_choose_photo')}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="pt-6">
                          <button 
                            type="submit"
                            disabled={isModerating}
                            className="w-full bg-gradient-to-r from-[#0066FF] to-[#00E5FF] py-4.5 rounded-2xl dark:text-white text-gray-900 font-black text-sm uppercase tracking-widest shadow-[0_8px_25px_rgba(61,155,255,0.3)] active:scale-95 transition-all border dark:border-white/20 border-black/20 flex items-center justify-center gap-2 disabled:opacity-70"
                          >
                            {isModerating ? (
                              <>
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                {t('lbl_moderating')}
                              </>
                            ) : (
                              t('lf_submit')
                            )}
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
            <motion.div 
              key="info" 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: -10 }} 
              className="space-y-6 pb-20"
            >
              {/* Info Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  {infoSubPage && (
                    <button 
                      onClick={() => setInfoSubPage(null)}
                      className="w-10 h-10 rounded-2xl dark:bg-white/5 bg-black/5 flex items-center justify-center text-[#0066FF] hover:bg-[#0066FF] hover:dark:text-white text-gray-900 transition-all active:scale-95 shadow-sm border dark:border-white/5 border-black/5"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                  )}
                  <h2 className="text-xl font-black dark:text-white text-gray-900 uppercase tracking-tighter drop-shadow-md">
                    {infoSubPage ? t(`lbl_${infoSubPage}` as any) : t('tab_info')}
                  </h2>
                </div>
                {!infoSubPage && (
                  <div className="px-4 py-1.5 rounded-full bg-gradient-to-r from-[#0066FF]/20 to-[#0055CC]/20 border border-[#0066FF]/30 text-[10px] font-black text-[#0066FF] uppercase tracking-[0.2em] shadow-inner">
                    {t('ver')}
                  </div>
                )}
              </div>

              <AnimatePresence mode="wait">
                {!infoSubPage ? (
                  <motion.div 
                    key="main-info"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    {/* User Profile Section */}
                    <div className="bg-gradient-to-br from-[#1a1a1a]/80 to-[#111111]/80 border dark:border-white/5 border-black/5 rounded-[1.5rem] p-5 backdrop-blur-md shadow-lg ring-1 ring-white/5 relative overflow-hidden group">
                      <div className="absolute inset-0 bg-gradient-to-br from-[#0066FF]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                      <div className="flex items-center gap-4 relative z-10">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#0066FF]/20 to-[#00E5FF]/20 flex items-center justify-center text-2xl border border-[#0066FF]/30 shadow-inner overflow-hidden">
                          {user?.photoURL ? (
                            <Image src={user.photoURL} alt="Profile" width={56} height={56} className="object-cover w-full h-full" referrerPolicy="no-referrer" />
                          ) : (
                            <UserIcon className="w-6 h-6 text-[#0066FF] drop-shadow-sm" />
                          )}
                        </div>
                        <div className="flex-1">
                          {user ? (
                            <>
                              <h3 className="text-sm font-black dark:text-white text-gray-900 tracking-tight drop-shadow-sm mb-1">{user.displayName || 'User'}</h3>
                              <p className="text-[10px] dark:text-[#a1a1aa] text-gray-500 font-medium">{user.email}</p>
                            </>
                          ) : (
                            <>
                              <h3 className="text-sm font-black dark:text-white text-gray-900 tracking-tight drop-shadow-sm mb-1">{t('lbl_guest')}</h3>
                              <p className="text-[10px] dark:text-[#a1a1aa] text-gray-500 font-medium">{t('lbl_signin_full')}</p>
                            </>
                          )}
                        </div>
                        <button 
                          onClick={user ? handleLogout : handleGoogleLogin}
                          className={cn(
                            "px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shadow-sm border active:scale-95",
                            user 
                              ? "dark:bg-white/5 bg-black/5 text-[#FF4444] dark:border-white/5 border-black/5 hover:bg-[#FF4444]/10 hover:border-[#FF4444]/30" 
                              : "bg-gradient-to-r from-[#0066FF] to-[#0055CC] text-white border-[#0066FF]/50 shadow-[0_4px_15px_rgba(61,155,255,0.3)]"
                          )}
                        >
                          {user ? t('lf_logout') : t('lf_login_btn')}
                        </button>
                      </div>
                    </div>

                    {/* Main Menu List */}
                    <div className="space-y-3">
                      {[
                        { id: 'how_to_use', label: t('lbl_how_to_use'), icon: Smartphone, color: 'text-[#00E5FF]', bg: 'bg-[#00E5FF]/10' },
                        { id: 'settings', label: t('lbl_settings'), icon: Settings, color: 'text-[#0066FF]', bg: 'bg-[#0066FF]/10' },
                        { id: 'hist', label: t('lbl_hist'), icon: AlertCircle, color: 'text-[#FF4444]', bg: 'bg-[#FF4444]/10' },
                        { id: 'rules', label: t('lbl_rules'), icon: Shield, color: 'text-[#ffb800]', bg: 'bg-[#ffb800]/10' },
                        ...(user?.email === 'zohidydy@gmail.com' ? [{ id: 'admin_sos', label: 'Admin SOS Panel', icon: Shield, color: 'text-[#FF4444]', bg: 'bg-[#FF4444]/10' }] : []),
                        { id: 'links', label: t('lbl_links'), icon: ExternalLink, color: 'text-[#00E5FF]', bg: 'bg-[#00E5FF]/10' },
                        { id: 'about', label: t('lbl_about'), icon: Info, color: 'text-[#0066FF]', bg: 'bg-[#0066FF]/10' },
                        { id: 'dev', label: t('lbl_dev'), icon: Smartphone, color: 'dark:text-[#ffffff] text-gray-900', bg: 'bg-[#ffffff]/10' },
                        { id: 'feedback', label: t('lbl_feedback'), icon: MessageSquare, color: 'text-[#FFB800]', bg: 'bg-[#FFB800]/10' },
                        { id: 'legal', label: t('lbl_legal'), icon: Shield, color: 'dark:text-[#a1a1aa] text-gray-500', bg: 'bg-[#a1a1aa]/10' },
                      ].map((item) => (
                        <button
                          key={item.id}
                          onClick={() => {
                            if (item.id === 'peta') {
                              setActivePage('peta');
                            } else {
                              setInfoSubPage(item.id as any);
                            }
                          }}
                          className="w-full bg-gradient-to-br from-[#1a1a1a]/80 to-[#111111]/80 border dark:border-white/5 border-black/5 rounded-2xl p-4 flex items-center justify-between group hover:dark:bg-[#1a1a1a] bg-white hover:dark:border-white/10 border-black/10 transition-all active:scale-[0.98] backdrop-blur-md shadow-sm hover:shadow-md"
                        >
                          <div className="flex items-center gap-4">
                            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner border dark:border-white/5 border-black/5 group-hover:scale-110 transition-transform", item.bg, item.color)}>
                              <item.icon className="w-5 h-5" />
                            </div>
                            <span className="text-sm font-black dark:text-white text-gray-900 tracking-tight">{item.label}</span>
                          </div>
                          <div className="w-8 h-8 rounded-full flex items-center justify-center dark:text-[#52525b] text-gray-400 group-hover:text-[#0066FF] group-hover:bg-[#0066FF]/10 transition-all">
                            <Navigation className="w-4 h-4 rotate-90" />
                          </div>
                        </button>
                      ))}
                    </div>
                    
                    <div className="pt-8 text-center">
                      <div className="text-[10px] dark:text-[#52525b] text-gray-400 font-black uppercase tracking-widest mb-1">{t('about_dev')}</div>
                      <div className="text-[9px] dark:text-[#52525b] text-gray-400 italic opacity-60">{t('mission')}</div>
                    </div>
                  </motion.div>
                ) : (
                /* Sub Pages Content */
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-6"
                >
                  {infoSubPage === 'admin_sos' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-black dark:text-white text-gray-900 uppercase tracking-tight">Active SOS Alerts</h3>
                        <div className="bg-[#FF4444]/10 text-[#FF4444] text-[10px] font-black px-3 py-1 rounded-full border border-[#FF4444]/20">
                          {sosAlerts.length} ACTIVE
                        </div>
                      </div>
                      
                      {sosAlerts.length === 0 ? (
                        <div className="dark:bg-white/5 bg-black/5 border border-dashed dark:border-white/10 border-black/10 rounded-2xl p-12 text-center">
                          <CheckCircle2 className="w-12 h-12 text-[#00E5FF] mx-auto mb-4 opacity-20" />
                          <p className="text-xs dark:text-[#52525b] text-gray-400 font-bold uppercase tracking-widest">No active alerts</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {sosAlerts.map((alert) => (
                            <div key={alert.id} className="bg-gradient-to-br from-[#1a1a1a] to-[#111111] border border-[#FF4444]/30 rounded-2xl p-5 shadow-lg relative overflow-hidden group">
                              <div className="absolute top-0 left-0 w-1 h-full bg-[#FF4444]" />
                              <div className="flex justify-between items-start mb-4">
                                <div>
                                  <div className="text-[10px] font-black text-[#FF4444] uppercase tracking-widest mb-1">SOS ALERT</div>
                                  <h4 className="dark:text-white text-gray-900 font-black text-base uppercase tracking-tight">{alert.userName}</h4>
                                </div>
                                <button 
                                  onClick={() => resolveSOS(alert.id)}
                                  className="bg-[#00E5FF]/10 hover:bg-[#00E5FF]/20 text-[#00E5FF] text-[10px] font-black px-4 py-2 rounded-xl border border-[#00E5FF]/20 transition-all active:scale-95"
                                >
                                  RESOLVE
                                </button>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-3 mb-4">
                                <div className="bg-black/30 rounded-xl p-3 border dark:border-white/5 border-black/5">
                                  <div className="text-[9px] dark:text-[#a1a1aa] text-gray-500 font-black uppercase mb-1">Location</div>
                                  <div className="text-[11px] dark:text-white text-gray-900 font-mono truncate">{alert.coords}</div>
                                </div>
                                <div className="bg-black/30 rounded-xl p-3 border dark:border-white/5 border-black/5">
                                  <div className="text-[9px] dark:text-[#a1a1aa] text-gray-500 font-black uppercase mb-1">Time</div>
                                  <div className="text-[11px] dark:text-white text-gray-900 font-mono">
                                    {alert.timestamp?.toDate ? alert.timestamp.toDate().toLocaleTimeString() : 'Just now'}
                                  </div>
                                </div>
                              </div>
                              
                              <button 
                                onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${alert.coords}`, '_blank')}
                                className="w-full dark:bg-white/5 bg-black/5 hover:dark:bg-white/10 bg-black/10 border dark:border-white/10 border-black/10 rounded-xl py-3 text-[10px] font-black dark:text-white text-gray-900 uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                              >
                                <MapPin className="w-3.5 h-3.5 text-[#0066FF]" />
                                Track on Maps
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {infoSubPage === 'how_to_use' && (
                    <div className="space-y-6">
                      <div className="bg-gradient-to-br from-[#1a1a1a]/80 to-[#111111]/80 border dark:border-white/5 border-black/5 rounded-3xl p-6 backdrop-blur-md shadow-sm">
                        <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-black/40 prose-pre:border prose-pre:dark:border-white/10 border-black/10 prose-a:text-[#0066FF] prose-strong:dark:text-white text-gray-900 prose-strong:font-black">
                          <ReactMarkdown>{t('how_to_use_content')}</ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  )}

                  {infoSubPage === 'settings' && (
                    <div className="space-y-6">
                      <div className="bg-gradient-to-br from-[#1a1a1a]/80 to-[#111111]/80 border dark:border-white/5 border-black/5 rounded-3xl p-6 backdrop-blur-md shadow-sm">
                        <div className="text-[10px] font-black dark:text-[#a1a1aa] text-gray-500 uppercase tracking-[0.2em] mb-5 flex items-center gap-2">
                          <span className="text-sm">🌍</span> {t('lbl_lang')}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          {[
                            { id: 'id', label: 'Indonesia', flag: '🇮🇩' },
                            { id: 'en', label: 'English', flag: '🇺🇸' },
                            { id: 'fr', label: 'Français', flag: '🇫🇷' },
                            { id: 'de', label: 'Deutsch', flag: '🇩🇪' },
                            { id: 'es', label: 'Español', flag: '🇪🇸' }
                          ].map((l) => (
                            <button
                              key={l.id}
                              onClick={() => setLang(l.id as Lang)}
                              className={cn(
                                "p-5 rounded-2xl border transition-all flex flex-col items-center gap-3 active:scale-95",
                                lang === l.id 
                                  ? "bg-gradient-to-br from-[#0066FF]/20 to-[#0055CC]/10 border-[#0066FF]/50 dark:text-white text-gray-900 shadow-[0_0_20px_rgba(61,155,255,0.2)] ring-1 ring-[#0066FF]/30" 
                                  : "dark:bg-white/5 bg-black/5 dark:border-white/5 border-black/5 dark:text-[#a1a1aa] text-gray-500 hover:dark:bg-white/10 bg-black/10 hover:dark:text-white text-gray-900"
                              )}
                            >
                              <span className="text-3xl drop-shadow-md">{l.flag}</span>
                              <span className="text-[11px] font-black uppercase tracking-widest text-center leading-tight">{l.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="bg-gradient-to-br from-[#1a1a1a]/80 to-[#111111]/80 border dark:border-white/5 border-black/5 rounded-3xl p-6 backdrop-blur-md shadow-sm">
                        <div className="text-[10px] font-black dark:text-[#a1a1aa] text-gray-500 uppercase tracking-[0.2em] mb-5 flex items-center gap-2">
                          <span className="text-sm">⚙️</span> {t('lbl_app_settings')}
                        </div>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between p-3 rounded-2xl hover:dark:bg-white/5 bg-black/5 transition-colors">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-xl dark:bg-white/5 bg-black/5 flex items-center justify-center text-lg shadow-inner border dark:border-white/5 border-black/5">
                                {theme === 'dark' ? '🌙' : '☀️'}
                              </div>
                              <span className="text-sm font-black dark:text-white text-gray-900 tracking-tight">
                                {t('lbl_dark_mode')}
                              </span>
                            </div>
                            <button
                              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                              className={cn(
                                "w-14 h-7 rounded-full transition-all relative shadow-inner border",
                                theme === 'dark'
                                  ? "bg-gradient-to-r from-[#0066FF] to-[#0055CC] border-[#0066FF]/50" 
                                  : "dark:bg-white/10 bg-black/10 dark:border-white/10 border-black/10"
                              )}
                            >
                              <div className={cn(
                                "w-6 h-6 bg-white rounded-full absolute top-0.5 transition-all shadow-md",
                                theme === 'dark' ? "translate-x-7" : "translate-x-0.5"
                              )} />
                            </button>
                          </div>
                          {[
                            { id: 'notifications', label: t('lbl_notif'), icon: '🔔' },
                            { id: 'location', label: t('lbl_loc'), icon: '📍' },
                            { id: 'dataSaver', label: t('lbl_data'), icon: '📶' }
                          ].map((setting) => (
                            <div key={setting.id} className="flex items-center justify-between p-3 rounded-2xl hover:dark:bg-white/5 bg-black/5 transition-colors">
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl dark:bg-white/5 bg-black/5 flex items-center justify-center text-lg shadow-inner border dark:border-white/5 border-black/5">{setting.icon}</div>
                                <span className="text-sm font-black dark:text-white text-gray-900 tracking-tight">{setting.label}</span>
                              </div>
                              <button
                                onClick={() => setAppSettings(prev => ({ ...prev, [setting.id]: !prev[setting.id as keyof typeof prev] }))}
                                className={cn(
                                  "w-14 h-7 rounded-full transition-all relative shadow-inner border",
                                  appSettings[setting.id as keyof typeof appSettings] 
                                    ? "bg-gradient-to-r from-[#00E5FF] to-[#00c896] border-[#00E5FF]/50" 
                                    : "dark:bg-white/10 bg-black/10 dark:border-white/10 border-black/10"
                                )}
                              >
                                <div className={cn(
                                  "w-6 h-6 bg-white rounded-full absolute top-0.5 transition-all shadow-md",
                                  appSettings[setting.id as keyof typeof appSettings] ? "translate-x-7" : "translate-x-0.5"
                                )} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {infoSubPage === 'hist' && (
                    <div className="bg-gradient-to-br from-[#1a1a1a]/80 to-[#111111]/80 border dark:border-white/5 border-black/5 rounded-3xl p-6 backdrop-blur-md shadow-sm">
                      {history.length === 0 ? (
                        <div className="text-center py-8 text-xs dark:text-[#52525b] text-gray-400 font-mono">{t('hist_empty')}</div>
                      ) : (
                        <div className="space-y-4">
                          {history.map((h, i) => (
                            <div key={i} className="flex gap-4 border-b dark:border-white/5 border-black/5 pb-4 last:border-0 last:pb-0">
                              <div className="w-10 h-10 rounded-xl bg-[#FF4444]/10 flex items-center justify-center border border-[#FF4444]/20 shrink-0">
                                <span className="text-lg">🆘</span>
                              </div>
                              <div>
                                <div className="text-xs font-black text-[#FF4444] tracking-tight mb-1">SOS SENT</div>
                                <div className="text-[10px] dark:text-[#a1a1aa] text-gray-500 font-mono">{h.time} • {h.coords}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {infoSubPage === 'rules' && (
                    <div className="space-y-3">
                      {[t('rule1'), t('rule2'), t('rule3'), t('rule4')].map((rule, i) => (
                        <div key={i} className="bg-gradient-to-br from-[#1a1a1a]/80 to-[#111111]/80 border dark:border-white/5 border-black/5 rounded-2xl p-5 text-xs dark:text-[#a1a1aa] text-gray-500 flex items-start gap-4 backdrop-blur-md shadow-sm">
                          <div className="w-2 h-2 rounded-full bg-[#0066FF] mt-1.5 shrink-0 shadow-[0_0_10px_rgba(61,155,255,0.5)]" />
                          <span className="leading-relaxed font-medium">{rule}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {infoSubPage === 'links' && (
                    <div className="space-y-3">
                      {[
                        { label: t('link1'), icon: '🚢', url: 'https://gilitransfers.com/fastboat-schedule' },
                        { label: t('link2'), icon: '🗺️', url: 'https://www.google.com/maps/search/Gili+Trawangan' },
                        { label: t('link3'), icon: '♻️', url: 'https://giliecotrust.com/waste-management' },
                        { label: t('link4'), icon: '🎫', url: 'https://pajak.lombokutarakab.go.id/' },
                        { label: t('link5'), icon: '🌤️', url: 'https://www.bmkg.go.id/cuaca/prakiraan-cuaca.bmkg?AreaID=501452' },
                        { label: t('link6'), icon: '🐢', url: 'https://giliecotrust.com/' },
                        { label: t('link7'), icon: '🚲', url: 'https://www.gili-trawangan.com/bicycles' }
                      ].map((link, i) => (
                        <button 
                          key={i} 
                          onClick={() => window.open(link.url, '_blank')}
                          className="w-full bg-gradient-to-br from-[#1a1a1a]/80 to-[#111111]/80 border dark:border-white/5 border-black/5 rounded-2xl p-5 text-xs dark:text-[#a1a1aa] text-gray-500 flex items-center justify-between hover:dark:bg-white/10 bg-black/10 hover:border-[#0066FF]/30 transition-all active:scale-[0.98] backdrop-blur-md shadow-sm group"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl dark:bg-white/5 bg-black/5 flex items-center justify-center border dark:border-white/5 border-black/5 group-hover:scale-110 transition-transform">
                              <span className="text-xl">{link.icon}</span>
                            </div>
                            <span className="font-black tracking-tight dark:text-white text-gray-900">{link.label}</span>
                          </div>
                          <ExternalLink className="w-4 h-4 dark:text-[#52525b] text-gray-400 group-hover:text-[#0066FF] transition-colors" />
                        </button>
                      ))}
                    </div>
                  )}

                  {infoSubPage === 'about' && (
                    <div className="bg-gradient-to-br from-[#1a1a1a]/80 to-[#111111]/80 border dark:border-white/5 border-black/5 rounded-3xl p-8 space-y-6 backdrop-blur-md shadow-sm">
                      <p className="text-xs dark:text-[#a1a1aa] text-gray-500 leading-relaxed font-medium">
                        {t('about_desc')}
                      </p>
                      <div className="space-y-4 pt-2">
                        {[t('about_feature1'), t('about_feature2'), t('about_feature3'), t('about_feature4')].map((f, i) => (
                          <div key={i} className="flex items-start gap-4 text-xs dark:text-white text-gray-900 font-medium leading-relaxed">
                            <div className="w-6 h-6 rounded-full bg-[#00E5FF]/10 flex items-center justify-center border border-[#00E5FF]/20 shrink-0 mt-0.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-[#00E5FF]" />
                            </div>
                            {f}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {infoSubPage === 'dev' && (
                    <div className="space-y-4">
                      <div className="bg-gradient-to-br from-[#1a1a1a]/80 to-[#111111]/80 border dark:border-white/5 border-black/5 rounded-3xl p-8 flex flex-col items-center text-center shadow-xl backdrop-blur-md ring-1 ring-white/5 relative overflow-hidden">
                        <div className="absolute -right-10 -top-10 w-40 h-40 bg-[#0066FF]/10 rounded-full blur-3xl" />
                        <div className="absolute -left-10 -bottom-10 w-32 h-32 bg-[#00E5FF]/5 rounded-full blur-2xl" />
                        
                        <div className="relative z-10 w-28 h-28 rounded-[2rem] bg-gradient-to-br from-[#0066FF]/20 to-[#0055CC]/10 border border-[#0066FF]/30 flex items-center justify-center overflow-hidden mb-5 rotate-3 shadow-[0_10px_30px_rgba(61,155,255,0.2)]">
                          <Image 
                            src="https://picsum.photos/seed/developer/300/300" 
                            alt="Developer" 
                            width={112} 
                            height={112}
                            className="object-cover -rotate-3 hover:scale-110 transition-transform duration-500"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div className="relative z-10 text-xl font-black dark:text-white text-gray-900 uppercase tracking-tight mb-1.5 drop-shadow-md">{t('dev_name')}</div>
                        <div className="relative z-10 text-[10px] text-[#0066FF] font-black mb-5 uppercase tracking-[0.3em] bg-[#0066FF]/10 px-4 py-1.5 rounded-full border border-[#0066FF]/20 shadow-inner">{t('dev_role')}</div>
                        <p className="relative z-10 text-xs dark:text-[#a1a1aa] text-gray-500 leading-relaxed italic mb-8 max-w-[280px]">&quot;{t('dev_desc')}&quot;</p>
                        
                        <div className="relative z-10 grid grid-cols-5 gap-3 w-full mb-8">
                          {[
                            { icon: MessageSquare, url: 'https://wa.me/6285293514808', color: 'hover:bg-[#25D366]/20 hover:text-[#25D366] hover:border-[#25D366]/30' },
                            { icon: Instagram, url: 'https://instagram.com/zohidy', color: 'hover:bg-[#E4405F]/20 hover:text-[#E4405F] hover:border-[#E4405F]/30' },
                            { icon: Linkedin, url: 'https://linkedin.com/in/zohidy', color: 'hover:bg-[#0A66C2]/20 hover:text-[#0A66C2] hover:border-[#0A66C2]/30' },
                            { icon: Github, url: 'https://github.com/zohidy', color: 'hover:dark:bg-white/20 bg-black/20 hover:dark:text-white text-gray-900 hover:border-white/30' },
                            { icon: Mail, url: 'mailto:zohidydy@gmail.com', color: 'hover:bg-[#0066FF]/20 hover:text-[#0066FF] hover:border-[#0066FF]/30' }
                          ].map((social, i) => (
                            <button 
                              key={i}
                              onClick={() => window.open(social.url, '_blank')}
                              className={cn(
                                "aspect-square rounded-2xl dark:bg-white/5 bg-black/5 border dark:border-white/5 border-black/5 flex items-center justify-center dark:text-[#a1a1aa] text-gray-500 transition-all active:scale-90 shadow-sm",
                                social.color
                              )}
                            >
                              <social.icon className="w-5 h-5" />
                            </button>
                          ))}
                        </div>

                        <div className="relative z-10 pt-6 border-t dark:border-white/10 border-black/10 w-full flex flex-col items-center">
                          <div className="text-[10px] dark:text-[#a1a1aa] text-gray-500 font-black uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[#FFB800] animate-pulse" />
                            {t('lbl_support_dev')}
                          </div>
                          <a href='https://ko-fi.com/zohidin' target='_blank' rel='noopener noreferrer' className="hover:scale-105 transition-transform active:scale-95 drop-shadow-xl hover:drop-shadow-2xl">
                            <Image 
                              src='https://storage.ko-fi.com/cdn/kofi2.png?v=6' 
                              alt='Buy Me a Coffee at ko-fi.com' 
                              width={150} 
                              height={40} 
                              className="h-10 w-auto"
                              referrerPolicy="no-referrer"
                            />
                          </a>
                        </div>
                      </div>
                    </div>
                  )}

                  {infoSubPage === 'feedback' && (
                    <div className="space-y-4">
                      <div className="bg-gradient-to-br from-[#1a1a1a]/80 to-[#111111]/80 border dark:border-white/5 border-black/5 rounded-3xl p-8 text-center backdrop-blur-md shadow-xl ring-1 ring-white/5 relative overflow-hidden">
                        <div className="absolute -right-10 -top-10 w-40 h-40 bg-[#FFB800]/10 rounded-full blur-3xl" />
                        <div className="absolute -left-10 -bottom-10 w-32 h-32 bg-[#0066FF]/10 rounded-full blur-2xl" />
                        
                        <div className="relative z-10 w-20 h-20 rounded-[2rem] bg-gradient-to-br from-[#FFB800]/20 to-[#ff9800]/10 border border-[#FFB800]/30 flex items-center justify-center mx-auto mb-6 shadow-[0_10px_30px_rgba(255,184,48,0.2)]">
                          <MessageSquare className="w-10 h-10 text-[#FFB800] drop-shadow-md" />
                        </div>
                        <h3 className="relative z-10 text-xl font-black dark:text-white text-gray-900 mb-3 uppercase tracking-tight drop-shadow-md">{t('lbl_feedback')}</h3>
                        <p className="relative z-10 text-xs dark:text-[#a1a1aa] text-gray-500 leading-relaxed mb-8 max-w-[280px] mx-auto">
                          {t('feedback_desc')}
                        </p>
                        
                        <div className="relative z-10 space-y-4">
                          <button 
                            onClick={() => window.open('mailto:zohidydy@gmail.com?subject=GiliGuard%20Feedback', '_blank')}
                            className="w-full bg-gradient-to-r from-[#0066FF] to-[#0055CC] text-white font-black py-4 rounded-2xl text-xs uppercase tracking-widest flex items-center justify-center gap-3 shadow-[0_8px_20px_rgba(61,155,255,0.3)] hover:shadow-[0_8px_25px_rgba(61,155,255,0.5)] transition-all active:scale-95 border dark:border-white/10 border-black/10"
                          >
                            <Mail className="w-5 h-5" />
                            {t('feedback_btn')}
                          </button>
                          
                          <button 
                            onClick={() => window.open('https://wa.me/6285293514808?text=Halo%20Zohidy,%20saya%20punya%20masukan%20untuk%20GiliGuard...', '_blank')}
                            className="w-full bg-gradient-to-r from-[#00E5FF] to-[#00c896] text-[#050505] font-black py-4 rounded-2xl text-xs uppercase tracking-widest flex items-center justify-center gap-3 shadow-[0_8px_20px_rgba(0,229,176,0.3)] hover:shadow-[0_8px_25px_rgba(0,229,176,0.5)] transition-all active:scale-95 border dark:border-white/10 border-black/10"
                          >
                            <MessageSquare className="w-5 h-5" />
                            {t('feedback_btn_wa')}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {infoSubPage === 'legal' && (
                    <div className="space-y-4">
                      <div className="bg-gradient-to-br from-[#1a1a1a]/80 to-[#111111]/80 border dark:border-white/5 border-black/5 rounded-3xl p-6 backdrop-blur-md shadow-xl ring-1 ring-white/5 relative overflow-hidden group hover:dark:border-white/10 border-black/10 transition-colors">
                        <div className="absolute -right-10 -top-10 w-32 h-32 bg-[#FF4444]/5 rounded-full blur-2xl group-hover:bg-[#FF4444]/10 transition-colors" />
                        <div className="relative z-10 text-[10px] font-black dark:text-white text-gray-900 uppercase tracking-[0.2em] mb-4 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-[#FF4444]/10 flex items-center justify-center border border-[#FF4444]/20">
                            <Shield className="w-4 h-4 text-[#FF4444]" />
                          </div>
                          {t('legal_terms_title')}
                        </div>
                        <p className="relative z-10 text-xs dark:text-[#a1a1aa] text-gray-500 leading-relaxed">
                          {t('legal_terms_desc')}
                        </p>
                      </div>
                      <div className="bg-gradient-to-br from-[#1a1a1a]/80 to-[#111111]/80 border dark:border-white/5 border-black/5 rounded-3xl p-6 backdrop-blur-md shadow-xl ring-1 ring-white/5 relative overflow-hidden group hover:dark:border-white/10 border-black/10 transition-colors">
                        <div className="absolute -right-10 -top-10 w-32 h-32 bg-[#00E5FF]/5 rounded-full blur-2xl group-hover:bg-[#00E5FF]/10 transition-colors" />
                        <div className="relative z-10 text-[10px] font-black dark:text-white text-gray-900 uppercase tracking-[0.2em] mb-4 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-[#00E5FF]/10 flex items-center justify-center border border-[#00E5FF]/20">
                            <CheckCircle2 className="w-4 h-4 text-[#00E5FF]" />
                          </div>
                          {t('legal_privacy_title')}
                        </div>
                        <p className="relative z-10 text-xs dark:text-[#a1a1aa] text-gray-500 leading-relaxed">
                          {t('legal_privacy_desc')}
                        </p>
                      </div>
                    </div>
                  )}
                  
                  <button 
                    onClick={() => setInfoSubPage(null)}
                    className="w-full py-4 rounded-2xl dark:bg-white/5 bg-black/5 text-[10px] font-bold dark:text-[#52525b] text-gray-400 uppercase tracking-widest hover:dark:bg-white/10 bg-black/10 transition-colors"
                  >
                    {t('lbl_back')}
                  </button>
                </motion.div>
              )}
              </AnimatePresence>

              <div className="pt-4 text-center">
                <div className="mt-2 text-[8px] dark:text-[#52525b] text-gray-400 uppercase tracking-widest opacity-40">{t('footer')}</div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none pb-6 px-4 bg-gradient-to-t from-[#050505] via-[#050505]/90 to-transparent pt-12">
        <nav className="pointer-events-auto w-full max-w-md dark:bg-[#111111] bg-white backdrop-blur-2xl border dark:border-white/10 border-black/10 p-2 rounded-3xl flex items-center justify-between shadow-[0_20px_40px_rgba(0,0,0,0.8)] ring-1 ring-white/5 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-50 pointer-events-none" />
          {[
            { id: 'beranda', icon: Home, label: t('nav1') },
            { id: 'kontak', icon: Phone, label: t('nav2') },
            { id: 'p3k', icon: HeartPulse, label: t('nav3') },
            { id: 'lostfound', icon: Package, label: t('nav6') },
          ].map((item) => {
            const isActive = activePage === item.id;
            return (
              <button 
                key={item.id}
                onClick={() => {
                  setActivePage(item.id as Page);
                  if (item.id !== 'info') setInfoSubPage(null);
                }}
                className="flex flex-col items-center justify-center gap-1.5 relative flex-1 py-2.5 rounded-2xl transition-all duration-300 group active:scale-95 z-10"
              >
                {isActive && (
                  <motion.div 
                    layoutId="nav-active-bg"
                    className="absolute inset-0 bg-gradient-to-b from-[#0066FF]/20 to-transparent rounded-2xl border-t border-[#0066FF]/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
                    transition={{ type: "spring", stiffness: 400, damping: 35 }}
                  />
                )}
                <item.icon className={cn(
                  "w-5 h-5 relative z-10 transition-all duration-300",
                  isActive ? "text-[#0066FF] scale-110 drop-shadow-[0_0_10px_rgba(61,155,255,0.8)]" : "dark:text-[#52525b] text-gray-400 group-hover:dark:text-[#a1a1aa] text-gray-500 group-hover:scale-110"
                )} />
                <span className={cn(
                  "text-[9px] font-black tracking-wide relative z-10 transition-all duration-300 truncate w-full text-center px-1",
                  isActive ? "dark:text-white text-gray-900 drop-shadow-md" : "dark:text-[#52525b] text-gray-400 group-hover:dark:text-[#a1a1aa] text-gray-500"
                )}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* SOS MODAL */}
      <AnimatePresence>
        {showSOSModal && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-end justify-center"
            onClick={() => !countdown && setShowSOSModal(false)}
          >
            <motion.div 
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="bg-gradient-to-b from-[#1a1a1a] to-[#111111] w-full max-w-md rounded-t-[2.5rem] border-t dark:border-white/10 border-black/10 p-8 pb-12 shadow-[0_-20px_40px_rgba(0,0,0,0.5)] relative overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-[#FF4444]/10 blur-3xl rounded-full pointer-events-none" />
              
              <div className="w-12 h-1.5 dark:bg-white/10 bg-black/10 rounded-full mx-auto mb-8" />
              
              <div className="flex flex-col items-center text-center relative z-10">
                <div className="w-20 h-20 bg-gradient-to-br from-[#FF4444]/20 to-[#CC0000]/10 rounded-[2rem] border border-[#FF4444]/30 flex items-center justify-center mb-6 shadow-[0_10px_30px_rgba(255,60,60,0.2)] rotate-3">
                  <span className="text-4xl drop-shadow-md -rotate-3">🆘</span>
                </div>
                <h2 className="text-3xl font-black mb-3 dark:text-white text-gray-900 uppercase tracking-tight drop-shadow-md">{t('m_title')}</h2>
                <p className="text-sm dark:text-[#a1a1aa] text-gray-500 leading-relaxed mb-8 font-medium max-w-[280px]">{t('m_desc')}</p>
              </div>
              
              <div className="bg-black/20 border dark:border-white/5 border-black/5 rounded-2xl p-4 flex items-center gap-4 mb-8 text-xs font-mono text-[#00E5FF] shadow-inner relative z-10 backdrop-blur-sm">
                <div className="p-2.5 bg-[#00E5FF]/10 rounded-xl border border-[#00E5FF]/20">
                  <MapPin className="w-5 h-5" />
                </div>
                <div className="flex-1 truncate font-bold tracking-tight text-sm">{coords}</div>
              </div>

              {countdown !== null ? (
                <div className="mb-4 relative z-10">
                  <div className="text-center mb-6 text-xs font-black uppercase tracking-[0.2em] text-[#FF4444] animate-pulse">
                    {t('cd_text')}
                  </div>
                  <div className="flex items-center justify-center mb-8">
                    <div className="w-32 h-32 rounded-full border-4 border-[#FF4444]/10 flex items-center justify-center relative bg-black/20 shadow-inner">
                      <motion.div 
                        initial={{ pathLength: 1 }}
                        animate={{ pathLength: 0 }}
                        transition={{ duration: 3, ease: "linear" }}
                        className="absolute inset-[-4px] rounded-full border-4 border-[#FF4444] shadow-[0_0_15px_rgba(255,60,60,0.5)]"
                      />
                      <span className="text-6xl font-black text-[#FF4444] drop-shadow-[0_0_15px_rgba(255,60,60,0.8)]">{countdown}</span>
                    </div>
                  </div>
                  <div className="text-center mt-4 text-[10px] font-black dark:text-[#a1a1aa] text-gray-500 uppercase tracking-[0.2em] mb-8">{t('cd_sec')}</div>
                  <button 
                    onClick={() => setCountdown(null)}
                    className="w-full dark:bg-white/5 bg-black/5 hover:dark:bg-white/10 bg-black/10 text-[#FF4444] py-5 rounded-2xl text-sm font-black uppercase tracking-[0.2em] transition-all border border-[#FF4444]/20 shadow-sm active:scale-95"
                  >{t('m_abort')}</button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 relative z-10">
                  <button 
                    onClick={() => setShowSOSModal(false)}
                    className="dark:bg-white/5 bg-black/5 hover:dark:bg-white/10 bg-black/10 dark:text-[#a1a1aa] text-gray-500 py-5 rounded-2xl text-xs font-black uppercase tracking-[0.15em] transition-all border dark:border-white/5 border-black/5 active:scale-95"
                  >{t('m_cancel')}</button>
                  <button 
                    onClick={() => setCountdown(3)}
                    className="bg-gradient-to-br from-[#FF4444] to-[#CC0000] text-white py-5 rounded-2xl text-xs font-black uppercase tracking-[0.15em] shadow-[0_10px_25px_rgba(255,60,60,0.4)] hover:shadow-[0_10px_30px_rgba(255,60,60,0.6)] active:scale-95 transition-all border border-[#FF4444]/50"
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
            className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[200] flex flex-col items-center justify-center p-8 text-center relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,60,60,0.15)_0%,transparent_70%)] animate-pulse" />
            
            <div className="relative z-10 w-32 h-32 bg-gradient-to-br from-[#FF4444]/20 to-[#CC0000]/10 rounded-[3rem] border border-[#FF4444]/30 flex items-center justify-center mb-8 shadow-[0_0_50px_rgba(255,60,60,0.3)] rotate-3">
              <span className="text-6xl drop-shadow-2xl -rotate-3 animate-bounce">🚨</span>
            </div>
            
            <h1 className="relative z-10 text-4xl font-black text-[#FF4444] mb-3 uppercase tracking-tight drop-shadow-[0_0_15px_rgba(255,60,60,0.5)]">{t('sent_title')}</h1>
            
            <div className="relative z-10 bg-black/40 border border-[#FF4444]/20 px-8 py-4 rounded-3xl mb-8 shadow-inner">
              <div className="text-6xl font-black font-mono dark:text-white text-gray-900 tracking-wider drop-shadow-md">{formatTime(sosTimer)}</div>
            </div>
            
            <div className="relative z-10 max-w-sm dark:bg-white/5 bg-black/5 border dark:border-white/10 border-black/10 rounded-3xl p-6 mb-10 backdrop-blur-md">
              <p className="text-sm dark:text-[#a1a1aa] text-gray-500 leading-relaxed mb-4 font-medium">
                {t('lbl_tell_operator')}<br/>
                <strong className="dark:text-white text-gray-900 text-base">{t('lbl_operator_hint')}</strong>
              </p>
              <div className="bg-black/30 rounded-2xl p-4 border dark:border-white/5 border-black/5 flex items-center gap-3 justify-center">
                <MapPin className="w-4 h-4 text-[#00E5FF]" />
                <span className="font-mono text-[#00E5FF] text-xs font-bold tracking-tight">{coords}</span>
              </div>
            </div>
            
            <button 
              onClick={() => setIsSOSSent(false)}
              className="relative z-10 dark:bg-white/5 bg-black/5 hover:dark:bg-white/10 bg-black/10 border dark:border-white/10 border-black/10 px-12 py-5 rounded-2xl font-black dark:text-[#a1a1aa] text-gray-500 uppercase tracking-[0.2em] transition-all active:scale-95"
            >{t('sent_close')}</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PWA INSTALL PROMPT */}
      <AnimatePresence>
        {showInstallPrompt && deferredPrompt && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.9 }} 
            animate={{ opacity: 1, y: 0, scale: 1 }} 
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-24 left-4 right-4 bg-gradient-to-br from-[#1a1a1a]/95 to-[#111111]/95 backdrop-blur-xl border border-[#0066FF]/30 rounded-[2rem] p-6 z-[80] shadow-[0_20px_50px_rgba(0,0,0,0.5)] ring-1 ring-white/10"
          >
            <div className="flex items-start gap-5">
              <div className="w-14 h-14 bg-gradient-to-br from-[#0066FF]/20 to-[#0055CC]/10 rounded-2xl flex items-center justify-center text-[#0066FF] border border-[#0066FF]/30 shadow-inner shrink-0">
                <Shield className="w-7 h-7 fill-[#0066FF]/20 drop-shadow-md" />
              </div>
              <div className="flex-1 pt-1">
                <h3 className="text-sm font-black dark:text-white text-gray-900 uppercase tracking-tight mb-1.5 drop-shadow-sm">{t('pwa_title')}</h3>
                <p className="text-xs dark:text-[#a1a1aa] text-gray-500 leading-relaxed mb-5 font-medium">{t('pwa_desc')}</p>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setShowInstallPrompt(false)}
                    className="flex-1 dark:bg-white/5 bg-black/5 hover:dark:bg-white/10 bg-black/10 dark:text-[#a1a1aa] text-gray-500 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] transition-all border dark:border-white/5 border-black/5 active:scale-95"
                  >{t('m_cancel')}</button>
                  <button 
                    onClick={() => {
                      handleInstall();
                      setShowInstallPrompt(false);
                    }}
                    className="flex-1 bg-gradient-to-r from-[#0066FF] to-[#0055CC] text-white py-3.5 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] shadow-[0_8px_20px_rgba(61,155,255,0.3)] hover:shadow-[0_8px_25px_rgba(61,155,255,0.5)] active:scale-95 transition-all border dark:border-white/10 border-black/10"
                  >{t('pwa_btn')}</button>
                </div>
              </div>
              <button onClick={() => setShowInstallPrompt(false)} className="dark:text-[#52525b] text-gray-400 hover:dark:text-white text-gray-900 transition-colors p-1 -mr-2 -mt-2">
                <X className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast.show && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: '-50%', scale: 0.9 }}
            animate={{ opacity: 1, y: 0, x: '-50%', scale: 1 }}
            exit={{ opacity: 0, y: 50, x: '-50%', scale: 0.9 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-28 left-1/2 z-[300] pointer-events-none"
          >
            <div className={cn(
              "px-5 py-3.5 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] flex items-center gap-3 border backdrop-blur-xl",
              toast.type === 'success' ? "bg-[#00E5FF]/10 border-[#00E5FF]/30 text-[#00E5FF]" : 
              toast.type === 'error' ? "bg-[#FF4444]/10 border-[#FF4444]/30 text-[#FF4444]" : 
              "bg-[#0066FF]/10 border-[#0066FF]/30 text-[#0066FF]"
            )}>
              {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 drop-shadow-md" />}
              {toast.type === 'error' && <AlertCircle className="w-5 h-5 drop-shadow-md" />}
              {toast.type === 'info' && <Info className="w-5 h-5 drop-shadow-md" />}
              <span className="text-xs font-black tracking-wide whitespace-nowrap drop-shadow-sm">{toast.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ONBOARDING TUTORIAL */}
      <AnimatePresence>
        {showOnboarding && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 dark:bg-black/95 bg-white/95 backdrop-blur-2xl z-[500] flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-sm dark:bg-gradient-to-br dark:from-[#1a1a1a] dark:to-[#111111] bg-white border dark:border-[#0066FF]/30 border-black/10 rounded-[2.5rem] overflow-hidden shadow-[0_30px_60px_rgba(0,0,0,0.8)] ring-1 ring-white/10"
            >
              <div className="p-8 text-center">
                <div className="min-h-[220px] flex flex-col items-center justify-center">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={onboardingStep}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="space-y-6 w-full"
                    >
                    <div className="w-24 h-24 bg-gradient-to-br from-[#0066FF]/20 to-[#00E5FF]/10 rounded-[2rem] border border-[#0066FF]/30 flex items-center justify-center mx-auto shadow-inner">
                      {onboardingStep === 0 && <Shield className="w-12 h-12 text-[#0066FF] drop-shadow-md" />}
                      {onboardingStep === 1 && <AlertTriangle className="w-12 h-12 text-[#FF4444] drop-shadow-md" />}
                      {onboardingStep === 2 && <Users className="w-12 h-12 text-[#0066FF] drop-shadow-md" />}
                      {onboardingStep === 3 && <Search className="w-12 h-12 text-[#00E5FF] drop-shadow-md" />}
                    </div>

                    <div className="space-y-3">
                      <h2 className="text-2xl font-black dark:text-white text-gray-900 uppercase tracking-tight">
                        {onboardingStep === 0 && t('onb_title')}
                        {onboardingStep === 1 && t('onb_step1_title')}
                        {onboardingStep === 2 && t('onb_step2_title')}
                        {onboardingStep === 3 && t('onb_step3_title')}
                      </h2>
                      <p className="text-sm dark:text-[#a1a1aa] text-gray-500 leading-relaxed font-medium">
                        {onboardingStep === 0 && t('onb_desc')}
                        {onboardingStep === 1 && t('onb_step1_desc')}
                        {onboardingStep === 2 && t('onb_step2_desc')}
                        {onboardingStep === 3 && t('onb_step3_desc')}
                      </p>
                    </div>
                  </motion.div>
                </AnimatePresence>
                </div>

                <div className="flex items-center justify-center gap-2 mt-10 mb-8">
                  {[0, 1, 2, 3].map((i) => (
                    <div 
                      key={i} 
                      className={cn(
                        "h-1.5 rounded-full transition-all duration-500",
                        onboardingStep === i ? "w-8 bg-[#0066FF] shadow-[0_0_10px_rgba(61,155,255,0.5)]" : "w-2 dark:bg-white/10 bg-black/10"
                      )}
                    />
                  ))}
                </div>

                <div className="flex gap-3">
                  {onboardingStep < 3 ? (
                    <>
                      <button 
                        onClick={finishOnboarding}
                        className="flex-1 dark:bg-white/5 bg-black/5 hover:dark:bg-white/10 bg-black/10 dark:text-[#a1a1aa] text-gray-500 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all border dark:border-white/5 border-black/5 active:scale-95"
                      >
                        {t('onb_skip')}
                      </button>
                      <button 
                        onClick={() => setOnboardingStep(prev => prev + 1)}
                        className="flex-1 bg-gradient-to-r from-[#0066FF] to-[#0055CC] text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-[0_10px_25px_rgba(61,155,255,0.3)] hover:shadow-[0_10px_30px_rgba(61,155,255,0.5)] active:scale-95 transition-all border dark:border-white/10 border-black/10"
                      >
                        {t('onb_next')}
                      </button>
                    </>
                  ) : (
                    <button 
                      onClick={finishOnboarding}
                      className="w-full bg-gradient-to-r from-[#00E5FF] to-[#00c590] dark:text-white text-gray-900 py-5 rounded-2xl text-xs font-black uppercase tracking-[0.2em] shadow-[0_10px_25px_rgba(0,229,176,0.3)] hover:shadow-[0_10px_30px_rgba(0,229,176,0.5)] active:scale-95 transition-all border dark:border-white/10 border-black/10"
                    >
                      {t('onb_start')}
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
