import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  BuildingAssessment,
  DisasterType,
  BuildingClass,
  BuildingCategory,
  BUILDING_CATEGORY_CONFIGS,
  SubComponentAssessment,
  DamageClassification,
  DukcapilRecord,
  BuildingPhoto,
  STANDARD_DAMAGE_LOCATIONS,
} from '../types';
import {
  PUPR_MASTER_COMPONENTS,
  getInitialSubComponents,
  calculateComponentScore,
  calculateTotalDamage,
  classifyDamage,
  calculateRehabCosts,
  formatRupiah,
} from '../utils/puprCalculations';
import { compressImageFile } from '../utils/imageCompressor';
import { BuildingPhotoGallery } from './BuildingPhotoGallery';
import { PhotoViewerModal } from './PhotoViewerModal';
import {
  Building2,
  Save,
  RotateCcw,
  Plus,
  Trash2,
  Calculator,
  Image,
  MapPin,
  FileCheck,
  AlertTriangle,
  ArrowLeft,
  FileSpreadsheet,
  ExternalLink,
  Link2,
  CheckCircle2,
  X,
  Settings,
  Home,
  Users,
  GraduationCap,
  Briefcase,
  Store,
  ShoppingBag,
  ShoppingCart,
  Landmark,
  Sparkles,
  Check,
  Info,
  Search,
  UserCheck,
  UserPlus,
  FolderPlus,
  Camera,
  UploadCloud,
  Eye,
  Layers,
  ZoomIn,
  Edit3,
  ImageIcon,
} from 'lucide-react';

export const AssessmentForm: React.FC = () => {
  const {
    currentUser,
    kecamatans,
    desas,
    dukcapilRecords,
    findDukcapil,
    addDukcapilRecord,
    addKecamatan,
    addDesa,
    addAssessment,
    updateAssessment,
    selectedAssessmentForEdit,
    setSelectedAssessmentForEdit,
    setActiveTab,
    showToast,
    googleSheetConfig,
    updateGoogleSheetConfig,
  } = useApp();

  const isEditMode = Boolean(selectedAssessmentForEdit);

  // Quick Google Sheet Link Modal state
  const [showSheetModal, setShowSheetModal] = useState(false);
  const [tempSpreadsheetUrl, setTempSpreadsheetUrl] = useState(googleSheetConfig.spreadsheetUrl || '');
  const [tempWebhookUrl, setTempWebhookUrl] = useState(googleSheetConfig.webhookUrl || '');
  const [tempSheetName, setTempSheetName] = useState(googleSheetConfig.sheetName || 'Data_Kerusakan_PUPR');

  // Form Fields
  const [code, setCode] = useState('');
  const [buildingCategory, setBuildingCategory] = useState<BuildingCategory>('Hunian Masyarakat');
  const [buildingName, setBuildingName] = useState('');
  const [namaPemilikRumah, setNamaPemilikRumah] = useState('');
  const [namaPemilikGedung, setNamaPemilikGedung] = useState('');
  const [disasterType, setDisasterType] = useState<DisasterType>('Gempa Bumi');
  const [disasterDate, setDisasterDate] = useState(new Date().toISOString().slice(0, 10));
  const [assessmentDate, setAssessmentDate] = useState(new Date().toISOString().slice(0, 10));
  const [yearBuilt, setYearBuilt] = useState(2018);
  const [ownerAgency, setOwnerAgency] = useState('');
  const [responsibleDepartment, setResponsibleDepartment] = useState('Dinas Pekerjaan Umum dan Penataan Ruang');
  const [buildingClass, setBuildingClass] = useState<BuildingClass>('Bangunan Tidak Sederhana');
  const [totalFloorAreaM2, setTotalFloorAreaM2] = useState<number>(150);
  const [numberOfFloors, setNumberOfFloors] = useState<number>(1);
  const [kecamatanId, setKecamatanId] = useState(kecamatans[0]?.id || '');
  const [desaId, setDesaId] = useState('');
  const [detailedAddress, setDetailedAddress] = useState('');
  const [latitude, setLatitude] = useState<number | undefined>(-8.6754);
  const [longitude, setLongitude] = useState<number | undefined>(121.3021);

  // Dukcapil NIK/KK and citizen search
  const [nikPemilik, setNikPemilik] = useState('');
  const [noKkPemilik, setNoKkPemilik] = useState('');
  const [dukcapilSearchQuery, setDukcapilSearchQuery] = useState('');
  const [isDukcapilSearchOpen, setIsDukcapilSearchOpen] = useState(false);
  const [selectedCitizenVerified, setSelectedCitizenVerified] = useState<DukcapilRecord | null>(null);

  // Quick Add Dukcapil Citizen Modal
  const [showQuickAddDukcapilModal, setShowQuickAddDukcapilModal] = useState(false);
  const [quickNik, setQuickNik] = useState('');
  const [quickNoKk, setQuickNoKk] = useState('');
  const [quickNama, setQuickNama] = useState('');
  const [quickJk, setQuickJk] = useState<'L' | 'P'>('L');
  const [quickHubungan, setQuickHubungan] = useState('KEPALA KELUARGA');
  const [quickAlamat, setQuickAlamat] = useState('');
  const [quickRt, setQuickRt] = useState('01');
  const [quickRw, setQuickRw] = useState('01');
  const [quickKecName, setQuickKecName] = useState('');
  const [quickDesaName, setQuickDesaName] = useState('');

  // Quick Add Kecamatan Modal
  const [showQuickAddKecModal, setShowQuickAddKecModal] = useState(false);
  const [quickKecCode, setQuickKecCode] = useState('');
  const [quickKecNewName, setQuickKecNewName] = useState('');

  // Quick Add Desa Modal
  const [showQuickAddDesaModal, setShowQuickAddDesaModal] = useState(false);
  const [quickDesaCode, setQuickDesaCode] = useState('');
  const [quickDesaNewName, setQuickDesaNewName] = useState('');
  const [quickDesaType, setQuickDesaType] = useState<'Desa' | 'Kelurahan'>('Desa');
  const [quickDesaIsPemekaran, setQuickDesaIsPemekaran] = useState(false);
  const [quickDesaNotes, setQuickDesaNotes] = useState('');

  // HSBGN and Costing
  const [hsbgnPerM2, setHsbgnPerM2] = useState<number>(7700000);
  const [demolitionPercent, setDemolitionPercent] = useState<number>(8);

  // Sub-components assessment
  const [components, setComponents] = useState<SubComponentAssessment[]>(getInitialSubComponents());

  // Photos State (Maksimal 10 Foto Visual per Bangunan)
  const [photos, setPhotos] = useState<BuildingPhoto[]>([]);
  const [photoInputMethod, setPhotoInputMethod] = useState<'upload' | 'url'>('upload');
  const [newPhotoDamageLocation, setNewPhotoDamageLocation] = useState<string>('Tampak Depan Bangunan');
  const [newPhotoCaption, setNewPhotoCaption] = useState('');
  const [newPhotoUrl, setNewPhotoUrl] = useState('');
  const [isProcessingPhotos, setIsProcessingPhotos] = useState(false);
  const [editingPhoto, setEditingPhoto] = useState<BuildingPhoto | null>(null);
  const [previewPhotoIndex, setPreviewPhotoIndex] = useState<number | null>(null);

  // City & Officials
  const [cityLocation, setCityLocation] = useState('Mbay');
  const [reportDateStr, setReportDateStr] = useState('Agustus 2026');
  const [headName, setHeadName] = useState('Dionisius T. Ndolu, S.T., M.Si.');
  const [headNip, setHeadNip] = useState('19740512 200212 1 004');
  const [headRank, setHeadRank] = useState('Pembina TK I');
  const [analysisTeam, setAnalysisTeam] = useState<string[]>([
    'Ir. Fransiskus Xaverius, S.T. (Ketua Tim Teknis)',
    'Petrus Kanisius, S.T. (Ahli Struktur)',
    'Yoseph Lodo, A.Md.T. (Surveyor Lapangan)',
    'Agustina Lali, S.T. (Estimator Anggaran)',
  ]);

  // Load existing data if edit mode
  useEffect(() => {
    if (selectedAssessmentForEdit) {
      const a = selectedAssessmentForEdit;
      setCode(a.code || '');
      setBuildingCategory(a.buildingCategory || 'Gedung Pemerintah');
      setBuildingName(a.buildingName);
      setNamaPemilikRumah(a.namaPemilikRumah || (a.buildingCategory === 'Hunian Masyarakat' ? a.ownerAgency : ''));
      setNamaPemilikGedung(a.namaPemilikGedung || (a.buildingCategory !== 'Hunian Masyarakat' ? a.ownerAgency : ''));
      setDisasterType(a.disasterType);
      setDisasterDate(a.disasterDate);
      setAssessmentDate(a.assessmentDate);
      setYearBuilt(a.yearBuilt);
      setOwnerAgency(a.ownerAgency || '');
      setResponsibleDepartment(a.responsibleDepartment);
      setBuildingClass(a.buildingClass);
      setTotalFloorAreaM2(a.totalFloorAreaM2);
      setNumberOfFloors(a.numberOfFloors);
      setKecamatanId(a.kecamatanId);
      setDesaId(a.desaId);
      setDetailedAddress(a.detailedAddress);
      setLatitude(a.latitude);
      setLongitude(a.longitude);
      setHsbgnPerM2(a.hsbgnPerM2);
      setDemolitionPercent(a.demolitionPercent);
      setComponents(a.components);
      setPhotos(a.photos);
      setNikPemilik(a.nikPemilik || '');
      setNoKkPemilik(a.noKkPemilik || '');
      setCityLocation(a.cityLocation);
      setReportDateStr(a.reportDateStr);
      setHeadName(a.headOfDepartment.name);
      setHeadNip(a.headOfDepartment.nip);
      setHeadRank(a.headOfDepartment.rank);
      setAnalysisTeam(a.analysisTeam);
    }
  }, [selectedAssessmentForEdit]);

  // Filter available desas based on selected kecamatan
  const availableDesas = desas.filter((d) => d.kecamatanId === kecamatanId);

  // Default select first desa when kecamatan changes if empty
  useEffect(() => {
    if (availableDesas.length > 0 && (!desaId || !availableDesas.some((d) => d.id === desaId))) {
      setDesaId(availableDesas[0].id);
    }
  }, [kecamatanId, availableDesas, desaId]);

  // Dukcapil search results
  const dukcapilSearchResults = React.useMemo(() => {
    if (!dukcapilSearchQuery.trim()) return [];
    return findDukcapil(dukcapilSearchQuery);
  }, [dukcapilSearchQuery, findDukcapil]);

  // When selecting a citizen from Dukcapil suggestions
  const handleSelectCitizen = (citizen: DukcapilRecord) => {
    setNikPemilik(citizen.nik);
    setNoKkPemilik(citizen.noKk);
    setOwnerAgency(citizen.namaLengkap);
    if (buildingCategory === 'Hunian Masyarakat') {
      setNamaPemilikRumah(citizen.namaLengkap);
    } else {
      setNamaPemilikGedung(citizen.namaLengkap);
    }
    setSelectedCitizenVerified(citizen);

    // If building category is Hunian Masyarakat or name is empty or starts with generic text
    if (
      !buildingName ||
      buildingName.startsWith('Rumah Tinggal') ||
      buildingName.startsWith('Rumah Hunian') ||
      buildingCategory === 'Hunian Masyarakat'
    ) {
      setBuildingName(`Rumah Tinggal Bpk./Ibu ${citizen.namaLengkap}`);
    }

    if (citizen.alamat && citizen.alamat !== '-') {
      const rtRwStr = citizen.rt || citizen.rw ? ` RT ${citizen.rt || '01'} / RW ${citizen.rw || '01'}` : '';
      setDetailedAddress(`${citizen.alamat}${rtRwStr}`);
    }

    // Auto-select matching Kecamatan & Desa
    const matchKec = kecamatans.find(
      (k) =>
        k.name.toLowerCase() === citizen.kecamatanName.toLowerCase() ||
        citizen.kecamatanName.toLowerCase().includes(k.name.toLowerCase())
    );
    if (matchKec) {
      setKecamatanId(matchKec.id);
      const matchDesa = desas.find(
        (d) =>
          d.kecamatanId === matchKec.id &&
          (d.name.toLowerCase() === citizen.desaName.toLowerCase() ||
            citizen.desaName.toLowerCase().includes(d.name.toLowerCase()))
      );
      if (matchDesa) {
        setDesaId(matchDesa.id);
      }
    }

    setIsDukcapilSearchOpen(false);
    setDukcapilSearchQuery('');
    showToast(`✓ Data Dukcapil terhubung: ${citizen.namaLengkap} (NIK: ${citizen.nik})`, 'success');
  };

  // Quick Add Dukcapil citizen handler
  const handleOpenQuickDukcapil = () => {
    const currentKec = kecamatans.find((k) => k.id === kecamatanId);
    const currentDesa = desas.find((d) => d.id === desaId);
    const cleanSearch = dukcapilSearchQuery.replace(/\D/g, '').slice(0, 16);
    setQuickNik(cleanSearch || `531601${Math.floor(1000000000 + Math.random() * 9000000000)}`);
    setQuickNoKk(`531601${Math.floor(1000000000 + Math.random() * 9000000000)}`);
    setQuickNama(isNaN(Number(dukcapilSearchQuery)) ? dukcapilSearchQuery.trim() : '');
    setQuickJk('L');
    setQuickHubungan('KEPALA KELUARGA');
    setQuickAlamat(detailedAddress || 'Jl. Trans Flores');
    setQuickRt('01');
    setQuickRw('01');
    setQuickKecName(currentKec?.name || 'Aesesa');
    setQuickDesaName(currentDesa?.name || 'Danga');
    setShowQuickAddDukcapilModal(true);
  };

  const handleSaveQuickDukcapil = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickNik.trim() || quickNik.trim().length < 8) {
      showToast('NIK minimal 8-16 digit angka!', 'error');
      return;
    }
    if (!quickNama.trim()) {
      showToast('Nama lengkap wajib diisi!', 'error');
      return;
    }

    const newRecord: DukcapilRecord = {
      id: `dukcapil_${Date.now()}`,
      nik: quickNik.trim(),
      noKk: quickNoKk.trim() || quickNik.trim(),
      namaLengkap: quickNama.trim().toUpperCase(),
      jenisKelamin: quickJk,
      statusHubungan: quickHubungan,
      alamat: quickAlamat.trim() || '-',
      rt: quickRt.trim() || '01',
      rw: quickRw.trim() || '01',
      kecamatanName: quickKecName.trim() || 'Aesesa',
      desaName: quickDesaName.trim() || 'Danga',
      sumberData: 'Manual',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const res = addDukcapilRecord(newRecord);
    if (res.success) {
      handleSelectCitizen(newRecord);
      setShowQuickAddDukcapilModal(false);
      showToast(res.message, 'success');
    } else {
      showToast(res.message, 'error');
    }
  };

  // Quick Add Kecamatan handler
  const handleOpenQuickKec = () => {
    const nextNum = kecamatans.length + 1;
    setQuickKecCode(`53.16.${String(nextNum).padStart(2, '0')}`);
    setQuickKecNewName('');
    setShowQuickAddKecModal(true);
  };

  const handleSaveQuickKec = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickKecNewName.trim()) {
      showToast('Nama kecamatan wajib diisi!', 'error');
      return;
    }
    const res = addKecamatan({
      code: quickKecCode.trim() || `53.16.${String(kecamatans.length + 1).padStart(2, '0')}`,
      name: quickKecNewName.trim(),
      capitalCity: quickKecNewName.trim(),
    });
    if (res.success && res.data) {
      setKecamatanId(res.data.id);
      setShowQuickAddKecModal(false);
      showToast(res.message, 'success');
    } else {
      showToast(res.message, 'error');
    }
  };

  // Quick Add Desa handler
  const handleOpenQuickDesa = (isPemekaran: boolean = false) => {
    const activeKec = kecamatans.find((k) => k.id === kecamatanId) || kecamatans[0];
    const kecNumber = activeKec?.code.split('.').pop() || '01';
    const nextNum = desas.filter((d) => d.kecamatanId === activeKec?.id).length + 2001;
    setQuickDesaCode(`53.16.${kecNumber}.${nextNum}`);
    setQuickDesaNewName('');
    setQuickDesaType('Desa');
    setQuickDesaIsPemekaran(isPemekaran);
    setQuickDesaNotes(
      isPemekaran
        ? 'Pemekaran wilayah desa baru'
        : 'Desa baru belum terdaftar sebelumnya'
    );
    setShowQuickAddDesaModal(true);
  };

  const handleSaveQuickDesa = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickDesaNewName.trim()) {
      showToast('Nama desa wajib diisi!', 'error');
      return;
    }
    const activeKec = kecamatans.find((k) => k.id === kecamatanId) || kecamatans[0];
    const res = addDesa({
      kecamatanId: activeKec.id,
      code: quickDesaCode.trim(),
      name: quickDesaNewName.trim(),
      type: quickDesaType,
      isPemekaran: quickDesaIsPemekaran,
      notes: quickDesaNotes.trim() || (quickDesaIsPemekaran ? 'Pemekaran Desa Baru' : 'Desa Baru Terdaftar'),
    });
    if (res.success && res.data) {
      setDesaId(res.data.id);
      setShowQuickAddDesaModal(false);
      showToast(res.message, 'success');
    } else {
      showToast(res.message, 'error');
    }
  };

  // Handler when user selects building category
  const handleCategorySelect = (category: BuildingCategory) => {
    setBuildingCategory(category);
    const config = BUILDING_CATEGORY_CONFIGS[category];
    if (config) {
      setHsbgnPerM2(config.defaultHsbgn);
      setBuildingClass(config.typicalClass);
      // If agency is blank or a generic default, update suggested placeholder
      if (
        !ownerAgency ||
        ownerAgency === 'Pemerintah Kabupaten' ||
        ownerAgency === 'Pemerintah Kabupaten Nagekeo' ||
        Object.values(BUILDING_CATEGORY_CONFIGS).some((c) => c.occupancyLabel === ownerAgency)
      ) {
        setOwnerAgency('');
      }
    }
  };

  const currentCategoryConfig = BUILDING_CATEGORY_CONFIGS[buildingCategory] || BUILDING_CATEGORY_CONFIGS['Hunian Masyarakat'];

  // Handle component damage input change
  const handleComponentChange = (id: string, damageInput: number) => {
    const clampedInput = Math.max(0, Math.min(100, damageInput));
    setComponents((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          const score = calculateComponentScore(c.bobotPercent, clampedInput);
          return {
            ...c,
            damagePercentInput: clampedInput,
            calculatedScore: score,
          };
        }
        return c;
      })
    );
  };

  // Calculations
  const totalDamagePercent = calculateTotalDamage(components);
  const damageClassification = classifyDamage(totalDamagePercent);
  const rehabCostDetails = calculateRehabCosts(
    totalDamagePercent,
    Number(totalFloorAreaM2) || 0,
    Number(hsbgnPerM2) || 0,
    Number(demolitionPercent) || 0
  );

  // Photo Handlers (Maksimal 10 Foto Visual)
  const handlePhotoFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    if (photos.length >= 10) {
      showToast('Batas maksimal 10 foto visual per bangunan telah tercapai!', 'warning');
      return;
    }

    const remainingSlots = 10 - photos.length;
    const filesToUpload = (Array.from(fileList) as File[]).slice(0, remainingSlots);

    if (fileList.length > remainingSlots) {
      showToast(`Hanya ${remainingSlots} foto yang diproses karena batas maksimal 10 foto.`, 'info');
    }

    setIsProcessingPhotos(true);
    try {
      const addedPhotos: BuildingPhoto[] = [];
      for (let i = 0; i < filesToUpload.length; i++) {
        const file: File = filesToUpload[i];
        const compressedBase64 = await compressImageFile(file, 1200, 1200, 0.78);

        let loc = newPhotoDamageLocation;
        if (!loc || loc === 'Tampak Depan Bangunan') {
          if (photos.length === 0 && i === 0) {
            loc = 'Tampak Depan Bangunan';
          } else {
            loc = newPhotoDamageLocation || 'Struktur - Kolom Praktis / Utama';
          }
        }

        const cap = newPhotoCaption.trim() || `Dokumentasi visual ${loc.toLowerCase()}`;

        addedPhotos.push({
          id: `photo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          url: compressedBase64,
          damageLocation: loc,
          caption: cap,
          takenAt: new Date().toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
        });
      }

      setPhotos((prev) => [...prev, ...addedPhotos]);
      setNewPhotoCaption('');
      showToast(`✓ Berhasil menambahkan ${addedPhotos.length} foto kerusakan (${photos.length + addedPhotos.length}/10)`, 'success');
    } catch (err) {
      console.error('Gagal kompres foto:', err);
      showToast('Gagal memproses file foto!', 'error');
    } finally {
      setIsProcessingPhotos(false);
      e.target.value = '';
    }
  };

  const handleAddUrlPhoto = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPhotoUrl.trim()) {
      showToast('URL foto wajib diisi!', 'error');
      return;
    }
    if (photos.length >= 10) {
      showToast('Batas maksimal 10 foto per bangunan telah tercapai!', 'warning');
      return;
    }

    const loc = newPhotoDamageLocation || 'Tampak Depan Bangunan';
    const cap = newPhotoCaption.trim() || `Dokumentasi visual ${loc.toLowerCase()}`;

    const newPhoto: BuildingPhoto = {
      id: `photo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      url: newPhotoUrl.trim(),
      damageLocation: loc,
      caption: cap,
      takenAt: new Date().toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
    };

    setPhotos((prev) => [...prev, newPhoto]);
    setNewPhotoUrl('');
    setNewPhotoCaption('');
    showToast(`✓ Foto berhasil ditambahkan (${photos.length + 1}/10)`, 'success');
  };

  const handleDeletePhoto = (photoId: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    showToast('Foto berhasil dihapus.', 'info');
  };

  const handleSaveEditPhoto = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPhoto) return;
    setPhotos((prev) =>
      prev.map((p) => (p.id === editingPhoto.id ? editingPhoto : p))
    );
    setEditingPhoto(null);
    showToast('Keterangan & bagian foto berhasil diperbarui.', 'success');
  };

  const handleLoadSamplePhotos = () => {
    const sampleList: BuildingPhoto[] = [
      {
        id: `sample_1_${Date.now()}`,
        url: 'https://images.unsplash.com/photo-1541888946425-d0fbb180c5f7?auto=format&fit=crop&w=1000&q=80',
        damageLocation: 'Tampak Depan Bangunan',
        caption: 'Tampak fasad depan bangunan mengalami penurunan elevasi dan retakan pada dinding muka.',
        takenAt: '2 Sep 2026',
      },
      {
        id: `sample_2_${Date.now()}`,
        url: 'https://images.unsplash.com/photo-1590381105924-c72589b9ef3f?auto=format&fit=crop&w=1000&q=80',
        damageLocation: 'Struktur - Kolom Praktis / Utama',
        caption: 'Retak geser diagonal (shear crack) pada kolom sudut lantai 1 melebihi toleransi struktural.',
        takenAt: '2 Sep 2026',
      },
      {
        id: `sample_3_${Date.now()}`,
        url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1000&q=80',
        damageLocation: 'Arsitektur - Dinding / Plesteran',
        caption: 'Dinding bata terlepas dari plesteran dan roboh sebagian pada ruang utama.',
        takenAt: '2 Sep 2026',
      },
      {
        id: `sample_4_${Date.now()}`,
        url: 'https://images.unsplash.com/photo-1584467735815-f778f274e296?auto=format&fit=crop&w=1000&q=80',
        damageLocation: 'Atap - Kuda-Kuda / Rangka Atap',
        caption: 'Rangka kuda-kuda bergeser dari dudukan ring balk akibat beban guncangan gempa.',
        takenAt: '2 Sep 2026',
      },
    ];

    setPhotos(sampleList);
    showToast('✓ 4 contoh foto standar PUPR berhasil dimuat untuk simulasi.', 'success');
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!buildingName.trim()) {
      showToast('Nama bangunan wajib diisi!', 'error');
      return;
    }

    if (!kecamatanId || !desaId) {
      showToast('Kecamatan dan Desa wajib dipilih!', 'error');
      return;
    }

    const currentKec = kecamatans.find((k) => k.id === kecamatanId);
    const currentDesa = desas.find((d) => d.id === desaId);

    const finalOwner = buildingCategory === 'Hunian Masyarakat'
      ? (namaPemilikRumah.trim() || ownerAgency.trim() || 'Pemilik Rumah')
      : (namaPemilikGedung.trim() || ownerAgency.trim() || 'Pengelola Gedung');

    const assessmentPayload: BuildingAssessment = {
      id: isEditMode ? selectedAssessmentForEdit!.id : `assess_${Date.now()}`,
      code: code.trim() || undefined,
      disasterType,
      disasterDate,
      assessmentDate,
      buildingName: buildingName.trim(),
      buildingCategory,
      yearBuilt: Number(yearBuilt),
      ownerAgency: finalOwner,
      namaPemilikRumah: buildingCategory === 'Hunian Masyarakat' ? (namaPemilikRumah.trim() || finalOwner) : undefined,
      namaPemilikGedung: buildingCategory !== 'Hunian Masyarakat' ? (namaPemilikGedung.trim() || finalOwner) : undefined,
      nikPemilik: nikPemilik.trim() || undefined,
      noKkPemilik: noKkPemilik.trim() || undefined,
      responsibleDepartment: responsibleDepartment.trim(),
      buildingClass,
      totalFloorAreaM2: Number(totalFloorAreaM2),
      numberOfFloors: Number(numberOfFloors),
      kecamatanId,
      kecamatanName: currentKec?.name || 'Kecamatan',
      desaId,
      desaName: currentDesa?.name || 'Desa',
      detailedAddress: detailedAddress.trim(),
      latitude,
      longitude,

      components,
      totalDamagePercent,
      damageClassification,

      hsbgnPerM2: Number(hsbgnPerM2),
      treatmentCostPerM2: rehabCostDetails.treatmentCostPerM2,
      demolitionPercent: Number(demolitionPercent),
      demolitionCostPerM2: rehabCostDetails.demolitionCostPerM2,
      totalCostPerM2: rehabCostDetails.totalCostPerM2,
      totalRehabCost: rehabCostDetails.totalRehabCost,
      roundedRehabCost: rehabCostDetails.roundedRehabCost,
      costTerbilang: rehabCostDetails.costTerbilang,

      photos,
      cityLocation,
      reportDateStr,
      headOfDepartment: {
        title: 'Kepala Dinas Pekerjaan Umum dan Penataan Ruang',
        subTitle: `Pemerintah Daerah`,
        rank: headRank,
        name: headName,
        nip: headNip,
      },
      analysisTeam,

      verificationStatus: isEditMode
        ? selectedAssessmentForEdit!.verificationStatus
        : 'Menunggu Verifikasi',
      googleSheetSynced: false,
      createdBy: currentUser.id,
      createdByName: currentUser.name,
      createdAt: isEditMode ? selectedAssessmentForEdit!.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (isEditMode) {
      const res = await updateAssessment(selectedAssessmentForEdit!.id, assessmentPayload);
      showToast(res.message, res.success ? 'success' : 'error');
    } else {
      const res = await addAssessment(assessmentPayload);
      showToast(res.message, res.success ? 'success' : 'error');
    }

    setSelectedAssessmentForEdit(null);
    setActiveTab('penilaian');
  };

  const handleResetScores = () => {
    setComponents(getInitialSubComponents());
    showToast('Tingkat kerusakan semua komponen di-reset ke 0%', 'info');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setSelectedAssessmentForEdit(null);
              setActiveTab('penilaian');
            }}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {isEditMode ? 'Edit Penilaian Kerusakan Gedung' : 'Formulir Penilaian Cepat Kerusakan Gedung'}
            </h2>
            <p className="text-xs text-slate-500">
              Format Standar PUPR: Analisis Komponen Pondasi, Struktur, Atap, Dinding, Lantai, Utilitas & Finishing
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetScores}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Nilai</span>
          </button>
          <button
            type="submit"
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-xl shadow-xs transition-colors"
          >
            <Save className="w-4 h-4" />
            <span>{isEditMode ? 'Simpan Perubahan' : 'Simpan & Hitung'}</span>
          </button>
        </div>
      </div>

      {/* Direct Google Sheet Saving Status Banner */}
      <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-slate-900">Penyimpanan Langsung Google Sheet</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-300">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                Langsung Tersimpan Tanpa Perlu Sinkronisasi
              </span>
            </div>
            <p className="text-slate-600 text-[11px] mt-0.5">
              Data penilaian gedung otomatis dikirim & langsung masuk ke tab Sheet <span className="font-bold text-emerald-900">"{googleSheetConfig.sheetName}"</span> begitu Anda klik Simpan.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          {googleSheetConfig.spreadsheetUrl && (
            <a
              href={googleSheetConfig.spreadsheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 font-semibold text-xs shadow-2xs transition-colors"
            >
              <span>Buka Google Sheet</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          <button
            type="button"
            onClick={() => {
              setTempSpreadsheetUrl(googleSheetConfig.spreadsheetUrl || '');
              setTempWebhookUrl(googleSheetConfig.webhookUrl || '');
              setTempSheetName(googleSheetConfig.sheetName || 'Data_Kerusakan_PUPR');
              setShowSheetModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs shadow-xs transition-colors"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Tentukan Link Sheet</span>
          </button>
        </div>
      </div>

      {/* Quick Google Sheet Link Modal */}
      {showSheetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                <span>Pengaturan Link Google Sheet Langsung</span>
              </div>
              <button
                type="button"
                onClick={() => setShowSheetModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Tentukan link Google Spreadsheet dan URL Webhook penulisan data Anda. Setiap formulir disimpan, data akan langsung tercatat otomatis di spreadsheet tanpa perlu tombol sinkronisasi manual.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Link Google Spreadsheet (URL Dokumen Sheet)
                </label>
                <input
                  type="url"
                  value={tempSpreadsheetUrl}
                  onChange={(e) => setTempSpreadsheetUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs.../edit"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Link file Google Sheet Anda agar tombol "Buka Google Sheet" langsung membuka spreadsheet ini.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  URL Web App / Webhook Apps Script (Penerima Data Otomatis)
                </label>
                <input
                  type="url"
                  value={tempWebhookUrl}
                  onChange={(e) => setTempWebhookUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  URL Web App dari Apps Script Google Sheet Anda (Who has access: Anyone) yang langsung menulis baris data baru.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nama Lembar Kerja (Sheet Tab Name)
                </label>
                <input
                  type="text"
                  value={tempSheetName}
                  onChange={(e) => setTempSheetName(e.target.value)}
                  placeholder="Data_Kerusakan_PUPR"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowSheetModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  let sheetUrl = tempSpreadsheetUrl.trim();
                  let hookUrl = tempWebhookUrl.trim();
                  if (hookUrl.includes('docs.google.com/spreadsheets') && !sheetUrl) {
                    sheetUrl = hookUrl;
                  }
                  updateGoogleSheetConfig({
                    spreadsheetUrl: sheetUrl,
                    webhookUrl: hookUrl,
                    sheetName: tempSheetName.trim() || 'Data_Kerusakan_PUPR',
                    directSaveEnabled: true,
                    autoSync: true,
                    lastTestedAt: new Date().toISOString(),
                    lastTestStatus: 'success',
                    lastTestMessage: 'Link penyimpanan Google Sheet berhasil diperbarui.',
                  });
                  setShowSheetModal(false);
                  showToast('Link Google Sheet berhasil disimpan! Data akan langsung otomatis tersimpan ke Sheet tersebut.', 'success');
                }}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors"
              >
                Terapkan Link Sheet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 1: Identitas Gedung & Bencana */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
        <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-600" />
            <span>I. Kategori Fungsi Gedung, Identitas & Bencana</span>
          </h3>
          <span className="text-xs text-slate-500">
            Standar PUPR &bull; Permen No. 22/PRT/M/2018
          </span>
        </div>

        {/* Building Category Selector Cards */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block font-bold text-slate-800 text-xs">
              Pilih Kategori / Fungsi Bangunan <span className="text-rose-500">*</span>
            </label>
            <span className="text-[11px] text-slate-500 font-medium">
              Otomatis menyesuaikan HSBGN & standar inspeksi
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {(Object.keys(BUILDING_CATEGORY_CONFIGS) as BuildingCategory[]).map((catKey) => {
              const catConfig = BUILDING_CATEGORY_CONFIGS[catKey];
              const isSelected = buildingCategory === catKey;

              const renderIcon = () => {
                switch (catConfig.iconName) {
                  case 'Home':
                    return <Home className="w-4 h-4" />;
                  case 'Users':
                    return <Users className="w-4 h-4" />;
                  case 'GraduationCap':
                    return <GraduationCap className="w-4 h-4" />;
                  case 'Briefcase':
                    return <Briefcase className="w-4 h-4" />;
                  case 'Store':
                    return <Store className="w-4 h-4" />;
                  case 'ShoppingBag':
                    return <ShoppingBag className="w-4 h-4" />;
                  case 'ShoppingCart':
                    return <ShoppingCart className="w-4 h-4" />;
                  default:
                    return <Landmark className="w-4 h-4" />;
                }
              };

              return (
                <button
                  key={catKey}
                  type="button"
                  onClick={() => handleCategorySelect(catKey)}
                  className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                    isSelected
                      ? 'bg-amber-50/80 border-amber-500 ring-2 ring-amber-500/20 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1 mb-1.5">
                    <div
                      className={`p-1.5 rounded-lg ${
                        isSelected
                          ? 'bg-amber-500 text-slate-950 font-bold'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {renderIcon()}
                    </div>
                    {isSelected && (
                      <span className="w-4 h-4 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 text-xs leading-tight">
                      {catConfig.shortLabel}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      HSBGN: Rp {(catConfig.defaultHsbgn / 1000000).toFixed(1)} Jt/M²
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active Category Information Callout */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-700 space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900">
                {currentCategoryConfig.name}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${currentCategoryConfig.badgeClass}`}>
                {currentCategoryConfig.typicalClass}
              </span>
            </div>
            <p className="text-[11px] text-slate-600">
              {currentCategoryConfig.description}
            </p>
            <div className="text-[11px] text-amber-900 bg-amber-50/80 p-2 rounded-lg border border-amber-200/70 flex items-start gap-1.5 mt-1">
              <Info className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>Petunjuk Lapangan Khusus:</strong> {currentCategoryConfig.inspectionTips}
              </span>
            </div>
          </div>
        </div>

        {/* Dukcapil Citizen Lookup & Auto-fill */}
        <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200/80 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-indigo-600 text-white">
                <UserCheck className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                  <span>Sinkronisasi Data Warga Dukcapil (NIK / KK / Nama)</span>
                  <span className="px-2 py-0.5 rounded-full bg-indigo-200 text-indigo-800 text-[10px] font-bold">
                    {dukcapilRecords.length} Terdata
                  </span>
                </h4>
                <p className="text-[11px] text-indigo-700">
                  Ketik nama atau NIK/KK untuk auto-fill nama pemilik, alamat rumah, desa & kecamatan.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleOpenQuickDukcapil}
              className="px-3 py-1.5 rounded-xl bg-white border border-indigo-300 text-indigo-800 hover:bg-indigo-100/60 font-bold text-xs flex items-center gap-1.5 shadow-2xs shrink-0 self-start sm:self-auto cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5 text-indigo-600" />
              <span>+ Daftarkan Warga Baru</span>
            </button>
          </div>

          {/* Search Input with dropdown suggestions */}
          <div className="relative">
            <div className="relative">
              <Search className="w-4 h-4 text-indigo-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={dukcapilSearchQuery}
                onChange={(e) => {
                  setDukcapilSearchQuery(e.target.value);
                  setIsDukcapilSearchOpen(true);
                }}
                onFocus={() => setIsDukcapilSearchOpen(true)}
                placeholder="Cari nama warga, 16-digit NIK, atau Nomor Kartu Keluarga..."
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-2xs font-medium placeholder:text-slate-400"
              />
              {dukcapilSearchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setDukcapilSearchQuery('');
                    setIsDukcapilSearchOpen(false);
                  }}
                  className="absolute right-3 top-2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Dropdown Suggestions */}
            {isDukcapilSearchOpen && dukcapilSearchQuery.trim().length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-indigo-200 rounded-2xl shadow-xl z-30 max-h-64 overflow-y-auto divide-y divide-slate-100">
                {dukcapilSearchResults.length > 0 ? (
                  dukcapilSearchResults.map((rec) => (
                    <button
                      key={rec.id}
                      type="button"
                      onClick={() => handleSelectCitizen(rec)}
                      className="w-full text-left p-3 hover:bg-indigo-50/70 transition-colors flex items-start justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="font-bold text-slate-900 flex items-center gap-2">
                          <span>{rec.namaLengkap}</span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-700">
                            NIK: {rec.nik}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-2">
                          <span>KK: {rec.noKk}</span>
                          <span>&bull;</span>
                          <span>Hub: {rec.statusHubungan}</span>
                          <span>&bull;</span>
                          <span className="font-medium text-indigo-700">
                            Ds. {rec.desaName}, Kec. {rec.kecamatanName}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {rec.alamat} (RT {rec.rt || '01'} / RW {rec.rw || '01'})
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-bold text-[10px] shrink-0">
                        Pilih & Isi Form
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="p-4 text-center text-xs">
                    <p className="text-slate-500 font-medium mb-2">
                      Tidak ditemukan data warga dengan kata kunci "{dukcapilSearchQuery}".
                    </p>
                    <button
                      type="button"
                      onClick={handleOpenQuickDukcapil}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Buat & Daftarkan Warga Baru Ini ke Dukcapil</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Active Citizen Badge if selected */}
          {selectedCitizenVerified && (
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  <strong>Terhubung ke Dukcapil:</strong> {selectedCitizenVerified.namaLengkap} (NIK: {selectedCitizenVerified.nik} | No. KK: {selectedCitizenVerified.noKk}) &bull; Ds. {selectedCitizenVerified.desaName}, Kec. {selectedCitizenVerified.kecamatanName}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCitizenVerified(null)}
                className="text-[11px] text-emerald-700 hover:text-emerald-900 font-semibold underline shrink-0 ml-2 cursor-pointer"
              >
                Lepas
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs pt-2">
          {/* No Registrasi / Kode (Opsional) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-semibold text-slate-700">
                No. Registrasi / Kode <span className="text-[10px] text-slate-400 font-normal">(Boleh Kosong)</span>
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCode(`REG-PUPR-2026-${String(Math.floor(Math.random() * 900) + 100)}`)}
                  className="text-[10px] text-amber-600 hover:text-amber-800 font-semibold cursor-pointer underline"
                >
                  Buat Otomatis
                </button>
                {code && (
                  <button
                    type="button"
                    onClick={() => setCode('')}
                    className="text-[10px] text-rose-500 hover:text-rose-700 font-semibold cursor-pointer underline ml-1"
                  >
                    Kosongkan
                  </button>
                )}
              </div>
            </div>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Boleh dikosongkan jika belum ada nomor registrasi"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-mono text-slate-800 placeholder:text-slate-400 text-xs"
            />
          </div>

          {/* Nama Bangunan */}
          <div className="sm:col-span-2">
            <label className="block font-semibold text-slate-700 mb-1">
              Nama Bangunan <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={buildingName}
              onChange={(e) => setBuildingName(e.target.value)}
              placeholder={
                buildingCategory === 'Hunian Masyarakat'
                  ? 'Contoh: Rumah Tinggal Bpk. Markus Dapa / RT 04'
                  : buildingCategory === 'Sekolah'
                  ? 'Contoh: SD Inpres Raja Selatan / SMPN 1 Mbay'
                  : buildingCategory === 'Toko'
                  ? 'Contoh: Toko Sembako Rejeki Jaya'
                  : buildingCategory === 'Minimarket'
                  ? 'Contoh: Minimarket Danga Mart 24 Jam'
                  : buildingCategory === 'Supermarket'
                  ? 'Contoh: Supermarket & Toserba Central Swalayan Mbay'
                  : buildingCategory === 'Perkantoran Swasta'
                  ? 'Contoh: Gedung Kantor PT Flores Mitra Konsultan'
                  : buildingCategory === 'Fasilitas Publik'
                  ? 'Contoh: Puskesmas Pembantu Mauponggo / Balai Serbaguna'
                  : 'Contoh: Gedung Kantor Pelayanan Dinas PUPR'
              }
              required
              className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 font-medium"
            />
          </div>

          {/* Nama Pemilik Rumah (Jika Hunian) ATAU Nama Pemilik Gedung / Pengelola (Jika Non-Hunian) */}
          {buildingCategory === 'Hunian Masyarakat' ? (
            <div className="sm:col-span-2 bg-amber-50/50 p-3 rounded-xl border border-amber-200/80">
              <label className="block font-bold text-amber-950 mb-1 flex items-center justify-between">
                <span>Nama Pemilik Rumah (Hunian Masyarakat)</span>
                <span className="text-[10px] text-amber-700 font-semibold px-2 py-0.5 rounded bg-amber-100">Kategori Hunian</span>
              </label>
              <input
                type="text"
                value={namaPemilikRumah || ownerAgency}
                onChange={(e) => {
                  setNamaPemilikRumah(e.target.value);
                  setOwnerAgency(e.target.value);
                }}
                placeholder="Contoh: Keluarga Bpk. Markus Dapa / Ibu Maria Fransiska"
                className="w-full px-3 py-2 rounded-lg border border-amber-300 bg-white font-semibold text-slate-900 placeholder:text-slate-400"
              />
              <p className="text-[10px] text-amber-800 mt-1">Nama kepala keluarga atau pemilik sah rumah hunian warga terdampak.</p>
            </div>
          ) : (
            <div className="sm:col-span-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <label className="block font-bold text-slate-800 mb-1 flex items-center justify-between">
                <span>Nama Pemilik Gedung / Instansi Pengelola</span>
                <span className="text-[10px] text-slate-600 font-semibold px-2 py-0.5 rounded bg-slate-200">{currentCategoryConfig.shortLabel}</span>
              </label>
              <input
                type="text"
                value={namaPemilikGedung || ownerAgency}
                onChange={(e) => {
                  setNamaPemilikGedung(e.target.value);
                  setOwnerAgency(e.target.value);
                }}
                placeholder={currentCategoryConfig.occupancyPlaceholder}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold text-slate-900 placeholder:text-slate-400"
              />
              <p className="text-[10px] text-slate-500 mt-1">Instansi pemerintah, yayasan, korporasi swasta, atau perorangan pemilik gedung.</p>
            </div>
          )}

          {/* Jenis Bencana */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Jenis Bencana</label>
            <select
              value={disasterType}
              onChange={(e) => setDisasterType(e.target.value as DisasterType)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-medium"
            >
              <option value="Gempa Bumi">Gempa Bumi</option>
              <option value="Banjir">Banjir</option>
              <option value="Tanah Longsor">Tanah Longsor</option>
              <option value="Angin Puting Beliung">Angin Puting Beliung</option>
              <option value="Tsunami">Tsunami</option>
              <option value="Kebakaran">Kebakaran</option>
              <option value="Likuefaksi">Likuefaksi</option>
              <option value="Erupsi Gunung Api">Erupsi Gunung Api</option>
              <option value="Bencana Lainnya">Bencana Lainnya</option>
            </select>
          </div>

          {/* Tanggal Bencana */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Tanggal Kejadian Bencana</label>
            <input
              type="date"
              value={disasterDate}
              onChange={(e) => setDisasterDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200"
            />
          </div>

          {/* Tanggal Penilaian */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Tanggal Penilaian Lapangan</label>
            <input
              type="date"
              value={assessmentDate}
              onChange={(e) => setAssessmentDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200"
            />
          </div>

          {/* Tahun Pembangunan */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Tahun Pembangunan Gedung</label>
            <input
              type="number"
              min={1900}
              max={2030}
              value={yearBuilt}
              onChange={(e) => setYearBuilt(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 font-medium"
            />
          </div>

          {/* NIK Pemilik */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1 flex items-center justify-between">
              <span>NIK Pemilik / Penghuni</span>
              <span className="text-[10px] text-slate-400 font-normal">16 Digit Angka</span>
            </label>
            <input
              type="text"
              maxLength={16}
              value={nikPemilik}
              onChange={(e) => setNikPemilik(e.target.value.replace(/\D/g, ''))}
              placeholder="Contoh: 5316011504780001"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-slate-800"
            />
          </div>

          {/* No KK Pemilik */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1 flex items-center justify-between">
              <span>Nomor Kartu Keluarga (KK)</span>
              <span className="text-[10px] text-slate-400 font-normal">16 Digit Angka</span>
            </label>
            <input
              type="text"
              maxLength={16}
              value={noKkPemilik}
              onChange={(e) => setNoKkPemilik(e.target.value.replace(/\D/g, ''))}
              placeholder="Contoh: 5316012301050012"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-slate-800"
            />
          </div>

          {/* Dinas Teknis */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Dinas Pembina Teknis</label>
            <input
              type="text"
              value={responsibleDepartment}
              onChange={(e) => setResponsibleDepartment(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200"
            />
          </div>

          {/* Kelas Bangunan */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Kelas Bangunan Gedung</label>
            <select
              value={buildingClass}
              onChange={(e) => setBuildingClass(e.target.value as BuildingClass)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
            >
              <option value="Bangunan Sederhana">Bangunan Sederhana</option>
              <option value="Bangunan Tidak Sederhana">Bangunan Tidak Sederhana</option>
              <option value="Bangunan Khusus">Bangunan Khusus</option>
            </select>
          </div>

          {/* Luas Lantai & Jumlah Tingkat */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Luas Total Lantai (M²)</label>
            <input
              type="number"
              min={1}
              value={totalFloorAreaM2}
              onChange={(e) => setTotalFloorAreaM2(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold text-slate-900"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Jumlah Tingkat</label>
            <input
              type="number"
              min={1}
              max={50}
              value={numberOfFloors}
              onChange={(e) => setNumberOfFloors(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold text-slate-900"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Tahun Dibangun</label>
            <input
              type="number"
              min={1950}
              max={2030}
              value={yearBuilt}
              onChange={(e) => setYearBuilt(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-slate-200"
            />
          </div>
        </div>
      </div>

      {/* SECTION 2: Lokasi Wilayah (Kecamatan & Desa Berjenjang) */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-600" />
            <span>II. Lokasi Wilayah Administrasi (Perkecamatan & Desa)</span>
          </h3>
          <button
            type="button"
            onClick={() => setActiveTab('wilayah')}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
          >
            + Pemekaran Desa Baru
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          {/* Kecamatan */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-semibold text-slate-700">
                Kecamatan <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                onClick={handleOpenQuickKec}
                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 cursor-pointer"
                title="Tambah kecamatan baru jika belum ada di daftar"
              >
                <Plus className="w-3 h-3" />
                <span>Tambah Kec.</span>
              </button>
            </div>
            <select
              value={kecamatanId}
              onChange={(e) => {
                setKecamatanId(e.target.value);
              }}
              required
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-semibold text-slate-800"
            >
              {kecamatans.map((k) => (
                <option key={k.id} value={k.id}>
                  Kec. {k.name} ({k.code})
                </option>
              ))}
            </select>
          </div>

          {/* Desa (Dibatasi per kecamatan yang dipilih) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-semibold text-slate-700">
                Desa / Kelurahan <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenQuickDesa(false)}
                  className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 cursor-pointer"
                  title="Tambah desa yang belum terdaftar di kecamatan ini"
                >
                  <Plus className="w-3 h-3" />
                  <span>Tambah Desa</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenQuickDesa(true)}
                  className="text-[11px] font-bold text-amber-600 hover:text-amber-800 flex items-center gap-0.5 cursor-pointer"
                  title="Tambah desa hasil pemekaran"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Pemekaran</span>
                </button>
              </div>
            </div>
            <select
              value={desaId}
              onChange={(e) => setDesaId(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-semibold text-slate-800"
            >
              {availableDesas.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.type} {d.name} {d.isPemekaran ? '★ Pemekaran' : ''}
                </option>
              ))}
              {availableDesas.length === 0 && (
                <option value="">Belum ada desa terdaftar di kecamatan ini</option>
              )}
            </select>
            <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
              <span>{availableDesas.length} Desa terdaftar di kecamatan ini</span>
              <button
                type="button"
                onClick={() => handleOpenQuickDesa(false)}
                className="text-indigo-600 hover:underline font-medium cursor-pointer"
              >
                + Belum terdaftar?
              </button>
            </div>
          </div>

          {/* Alamat Lengkap */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Alamat Lengkap / Patokan</label>
            <input
              type="text"
              value={detailedAddress}
              onChange={(e) => setDetailedAddress(e.target.value)}
              placeholder="Contoh: Jl. Trans Flores Km. 4 Kompleks Pasar"
              className="w-full px-3 py-2 rounded-xl border border-slate-200"
            />
          </div>
        </div>
      </div>

      {/* SECTION 3: TABEL BOBOT & TINGKAT KERUSAKAN 8 KOMPONEN PUPR */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Calculator className="w-4 h-4 text-amber-600" />
              <span>III. Analisis Cepat Tingkat Kerusakan Komponen Bangunan (Standar PUPR)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Input persentase kerusakan teramati (0% - 100%) pada masing-masing sub-komponen bangunan
            </p>
          </div>

          {/* Live damage badge */}
          <div className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl">
            <span className="text-xs text-slate-300">Total Kerusakan:</span>
            <span className="text-base font-black text-amber-400">
              {totalDamagePercent.toFixed(2)}%
            </span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                damageClassification === 'Rusak Ringan'
                  ? 'bg-emerald-500 text-slate-950'
                  : damageClassification === 'Rusak Sedang'
                  ? 'bg-amber-400 text-slate-950'
                  : 'bg-rose-500 text-white'
              }`}
            >
              {damageClassification}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <th className="py-2.5 px-3 w-10 text-center">NO</th>
                <th className="py-2.5 px-3">KOMPONEN BANGUNAN</th>
                <th className="py-2.5 px-3">SUB KOMPONEN BANGUNAN</th>
                <th className="py-2.5 px-3 text-center w-28">BOBOT (%)</th>
                <th className="py-2.5 px-3 text-center w-28">MAX (%)</th>
                <th className="py-2.5 px-3 text-center w-36">INPUT KERUSAKAN (%)</th>
                <th className="py-2.5 px-3 text-right w-28">NILAI (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {components.map((c, index) => {
                const isNewGroup =
                  index === 0 || c.componentNo !== components[index - 1].componentNo;

                return (
                  <tr
                    key={c.id}
                    className={`hover:bg-amber-50/40 transition-colors ${
                      c.damagePercentInput > 0 ? 'bg-amber-50/20' : ''
                    }`}
                  >
                    <td className="py-2.5 px-3 text-center font-bold text-slate-500">
                      {isNewGroup ? c.componentNo : ''}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">
                      {isNewGroup ? c.componentName : ''}
                    </td>
                    <td className="py-2.5 px-3 text-slate-800 font-medium">
                      {c.subComponentName}
                    </td>
                    <td className="py-2.5 px-3 text-center text-slate-600 font-mono">
                      {c.bobotPercent.toFixed(2)}%
                    </td>
                    <td className="py-2.5 px-3 text-center text-slate-400 font-mono">
                      {c.kerusakanMaxPercent.toFixed(2)}%
                    </td>
                    <td className="py-2 px-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={1}
                          value={c.damagePercentInput}
                          onChange={(e) =>
                            handleComponentChange(c.id, parseFloat(e.target.value) || 0)
                          }
                          className="w-20 px-2 py-1 text-center font-bold rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white"
                        />
                        <span className="text-slate-400 font-semibold">%</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900 font-mono">
                      {c.calculatedScore.toFixed(2)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-900 text-white font-bold text-xs border-t-2 border-slate-900">
                <td colSpan={3} className="py-3 px-4 text-left uppercase tracking-wider">
                  Total Bobot & Nilai Tingkat Kerusakan (%)
                </td>
                <td className="py-3 px-3 text-center text-amber-300 font-mono">100.00%</td>
                <td></td>
                <td></td>
                <td className="py-3 px-3 text-right text-amber-400 font-mono text-sm">
                  {totalDamagePercent.toFixed(2)}%
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* SECTION 4: ESTIMASI BIAYA REHABILITASI (RAB PUPR) */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center gap-2">
          <FileCheck className="w-4 h-4 text-emerald-600" />
          <span>IV. Kesimpulan Analisis Hasil Pengamatan & Ajuan Biaya Rehabilitasi</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          {/* Settings / Inputs */}
          <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <h4 className="font-bold text-slate-800">Parameter Perhitungan Standar PUPR</h4>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block font-semibold text-slate-700">
                  Harga Satuan / HSBGN Konstruksi (Rp / M²)
                </label>
                <button
                  type="button"
                  onClick={() => setHsbgnPerM2(currentCategoryConfig.defaultHsbgn)}
                  className="text-[11px] font-semibold text-amber-800 hover:text-amber-950 underline"
                >
                  Standar {currentCategoryConfig.shortLabel} (Rp {formatRupiah(currentCategoryConfig.defaultHsbgn)})
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-500">Rp</span>
                <input
                  type="number"
                  step={50000}
                  value={hsbgnPerM2}
                  onChange={(e) => setHsbgnPerM2(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold text-slate-900 bg-white"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Standar acuan biaya rekonstruksi/HSBGN untuk kategori <strong>{currentCategoryConfig.name}</strong>.
              </p>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Biaya Bongkaran & Perapihan (%)
              </label>
              <input
                type="number"
                min={0}
                max={25}
                step={0.5}
                value={demolitionPercent}
                onChange={(e) => setDemolitionPercent(Number(e.target.value))}
                className="w-24 px-3 py-1.5 rounded-xl border border-slate-200 font-bold bg-white"
              />
              <span className="ml-2 text-slate-500 font-medium">Standar PUPR: 5% - 10% (Default 8%)</span>
            </div>
          </div>

          {/* Detailed Calculations Output (Exact PUPR format from CSV) */}
          <div className="space-y-2 bg-amber-50/50 p-4 rounded-xl border border-amber-200">
            <h4 className="font-bold text-amber-950">Rincian Perhitungan Biaya</h4>

            <div className="flex items-center justify-between py-1 border-b border-amber-100">
              <span className="text-slate-600">A. Jenis Perawatan:</span>
              <strong className="text-slate-900 font-bold">{damageClassification}</strong>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-amber-100">
              <span className="text-slate-600">B. Tingkat (%) Kerusakan:</span>
              <strong className="text-slate-900 font-mono font-bold">
                {totalDamagePercent.toFixed(2)}%
              </strong>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-amber-100">
              <span className="text-slate-600">C. Luas Total Bangunan:</span>
              <strong className="text-slate-900 font-bold">{totalFloorAreaM2} M²</strong>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-amber-100">
              <span className="text-slate-600">D. Nilai Perawatan / M²:</span>
              <span className="text-slate-900 font-mono font-semibold">
                {formatRupiah(rehabCostDetails.treatmentCostPerM2)}
              </span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-amber-100">
              <span className="text-slate-600">E. Biaya Bongkaran ({demolitionPercent}%) / M²:</span>
              <span className="text-slate-900 font-mono font-semibold">
                {formatRupiah(rehabCostDetails.demolitionCostPerM2)}
              </span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-amber-200 font-semibold text-slate-900">
              <span>Subtotal Biaya / M²:</span>
              <span className="font-mono">{formatRupiah(rehabCostDetails.totalCostPerM2)}</span>
            </div>

            <div className="pt-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-bold text-slate-900">Ajuan Biaya Dibulatkan:</span>
                <span className="font-black text-amber-900 text-base font-mono">
                  {formatRupiah(rehabCostDetails.roundedRehabCost)}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 italic mt-1 font-medium bg-white/70 p-2 rounded-lg border border-amber-200/50">
                Terbilang: {rehabCostDetails.costTerbilang}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 5: Tim Analisis Lapangan & Penandatanganan */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center gap-2">
          <FileCheck className="w-4 h-4 text-indigo-600" />
          <span>V. Tim Analisis & Pengesahan Dokumen</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Kota Tempat Laporan Dibuat</label>
            <input
              type="text"
              value={cityLocation}
              onChange={(e) => setCityLocation(e.target.value)}
              placeholder="Contoh: Mbay, Seba, Kupang"
              className="w-full px-3 py-2 rounded-xl border border-slate-200"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Bulan & Tahun Dokumen</label>
            <input
              type="text"
              value={reportDateStr}
              onChange={(e) => setReportDateStr(e.target.value)}
              placeholder="Contoh: Agustus 2026"
              className="w-full px-3 py-2 rounded-xl border border-slate-200"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Nama Kepala Dinas PUPR</label>
            <input
              type="text"
              value={headName}
              onChange={(e) => setHeadName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 font-semibold"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">NIP Kepala Dinas</label>
            <input
              type="text"
              value={headNip}
              onChange={(e) => setHeadNip(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono"
            />
          </div>
        </div>
      </div>

      {/* SECTION VI: Dokumentasi Foto Visual Kerusakan Fisik Bangunan (Maksimal 10 Foto) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <span>VI. Dokumentasi Foto Visual Kerusakan Bangunan</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold font-mono ${
                    photos.length >= 10
                      ? 'bg-rose-100 text-rose-700 border border-rose-300'
                      : photos.length > 0
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}
                >
                  {photos.length} / 10 Foto Terunggah
                </span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Maksimal 10 foto visual per satu bangunan gedung/rumah. Wajib menentukan bagian kerusakan agar verifikator teknis mengetahui detail lokasi foto.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleLoadSamplePhotos}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-semibold transition-colors cursor-pointer"
              title="Muat 4 contoh dokumentasi foto kerusakan berstandar PUPR untuk simulasi pengujian"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Muat Contoh Foto Standar PUPR</span>
            </button>
          </div>
        </div>

        {/* Input / Upload Panel */}
        <div className="bg-slate-50 rounded-2xl border border-slate-200/80 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl">
              <button
                type="button"
                onClick={() => setPhotoInputMethod('upload')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  photoInputMethod === 'upload'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <UploadCloud className="w-3.5 h-3.5" />
                  Unggah File / Kamera HP
                </span>
              </button>
              <button
                type="button"
                onClick={() => setPhotoInputMethod('url')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  photoInputMethod === 'url'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5" />
                  Tautkan URL Gambar Online
                </span>
              </button>
            </div>

            <div className="text-[11px] text-slate-500 font-medium hidden sm:block">
              {10 - photos.length > 0 ? (
                <span>Tersedia kuota <strong>{10 - photos.length} foto</strong> lagi</span>
              ) : (
                <span className="text-rose-600 font-bold">Batas 10 foto penuh</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs">
            {/* Bagian Kerusakan (Dropdown Standar PUPR) */}
            <div className="md:col-span-5">
              <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-amber-600" />
                <span>Bagian Kerusakan Yang Difoto <span className="text-rose-500">*</span></span>
              </label>
              <select
                value={newPhotoDamageLocation}
                onChange={(e) => setNewPhotoDamageLocation(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-semibold text-slate-900 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              >
                {STANDARD_DAMAGE_LOCATIONS.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Memudahkan verifikator menilai komponen struktural / non-struktural.
              </p>
            </div>

            {/* Keterangan Kerusakan Spesifik */}
            <div className="md:col-span-7">
              <label className="block font-bold text-slate-700 mb-1">
                Keterangan / Detail Kerusakan Pada Foto
              </label>
              <input
                type="text"
                value={newPhotoCaption}
                onChange={(e) => setNewPhotoCaption(e.target.value)}
                placeholder="Contoh: Retak geser diagonal lebar >3mm pada pertemuan kolom sudut..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
              <p className="text-[10px] text-slate-400 mt-0.5">
                Jelaskan visual keparahan, retakan, atau elemen yang ambruk/patah.
              </p>
            </div>
          </div>

          {/* Action Upload File or Add URL */}
          {photoInputMethod === 'upload' ? (
            <div className="pt-1">
              <label
                className={`relative flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${
                  photos.length >= 10
                    ? 'border-slate-200 bg-slate-100/60 opacity-60 cursor-not-allowed'
                    : 'border-amber-300 bg-amber-50/40 hover:bg-amber-50/80 hover:border-amber-400'
                }`}
              >
                <div className="flex flex-col items-center text-center space-y-1.5">
                  <div className="p-3 rounded-full bg-amber-500/10 text-amber-600">
                    <Camera className="w-6 h-6" />
                  </div>
                  <div className="text-xs font-bold text-slate-800">
                    {isProcessingPhotos ? (
                      <span className="text-amber-600 animate-pulse font-bold">
                        Sedang memproses dan mengompresi ukuran foto...
                      </span>
                    ) : photos.length >= 10 ? (
                      <span className="text-slate-500">Batas kuota 10 foto telah terpenuhi</span>
                    ) : (
                      <span>Pilih Foto dari Galeri HP / Kamera / Komputer (Bisa Pilih Sekaligus)</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    File otomatis dikompresi agar ukuran tetap ringan dan kualitas tetap jernih untuk diperbesar
                  </p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={photos.length >= 10 || isProcessingPhotos}
                  onChange={handlePhotoFilesSelected}
                  className="hidden"
                />
              </label>
            </div>
          ) : (
            <div className="pt-1 flex flex-col sm:flex-row gap-2">
              <input
                type="url"
                value={newPhotoUrl}
                onChange={(e) => setNewPhotoUrl(e.target.value)}
                placeholder="https://images.unsplash.com/photo-..."
                disabled={photos.length >= 10}
                className="flex-1 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-mono"
              />
              <button
                type="button"
                onClick={handleAddUrlPhoto}
                disabled={photos.length >= 10 || !newPhotoUrl.trim()}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Tambahkan Foto URL</span>
              </button>
            </div>
          )}
        </div>

        {/* Render Thumbnails Gallery */}
        <div className="pt-2">
          <BuildingPhotoGallery
            photos={photos}
            buildingTitle={`${buildingName || 'Bangunan Gedung'} (Kec. ${kecamatans.find((k) => k.id === kecamatanId)?.name || 'Kecamatan'})`}
            isEditable={true}
            onDeletePhoto={handleDeletePhoto}
            onEditPhoto={(p) => setEditingPhoto(p)}
            onSelectPhoto={(idx) => setPreviewPhotoIndex(idx)}
          />
        </div>
      </div>

      {/* Submit Button Bar */}
      <div className="flex items-center justify-end gap-3 pt-4">
        <button
          type="button"
          onClick={() => {
            setSelectedAssessmentForEdit(null);
            setActiveTab('penilaian');
          }}
          className="px-5 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
        >
          Batal
        </button>
        <button
          type="submit"
          className="flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-xl shadow-md shadow-amber-500/20 transition-all cursor-pointer"
        >
          <Save className="w-4 h-4" />
          <span>{isEditMode ? 'Simpan Perubahan Penilaian' : 'Simpan & Sinkronkan Data'}</span>
        </button>
      </div>

      {/* MODAL 1: Quick Add Dukcapil Citizen */}
      {showQuickAddDukcapilModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
            <div className="px-6 py-4 bg-indigo-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-indigo-200" />
                <h3 className="font-bold text-sm">Daftarkan Data Warga Baru ke Dukcapil</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowQuickAddDukcapilModal(false)}
                className="text-indigo-200 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveQuickDukcapil} className="p-6 space-y-4 text-xs">
              <p className="text-slate-500">
                Warga ini belum tercatat di master data Dukcapil. Masukkan data identitas agar tersimpan permanen dan otomatis mengisi form penilaian saat ini.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    NIK (16 Digit) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    maxLength={16}
                    value={quickNik}
                    onChange={(e) => setQuickNik(e.target.value.replace(/\D/g, ''))}
                    placeholder="531601xxxxxxxxxx"
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">No. Kartu Keluarga (KK)</label>
                  <input
                    type="text"
                    maxLength={16}
                    value={quickNoKk}
                    onChange={(e) => setQuickNoKk(e.target.value.replace(/\D/g, ''))}
                    placeholder="531601xxxxxxxxxx"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nama Lengkap Sesuai KTP <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={quickNama}
                  onChange={(e) => setQuickNama(e.target.value)}
                  placeholder="Contoh: YOHANES WANGGE"
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold uppercase text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Jenis Kelamin</label>
                  <select
                    value={quickJk}
                    onChange={(e) => setQuickJk(e.target.value as 'L' | 'P')}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                  >
                    <option value="L">Laki-Laki (L)</option>
                    <option value="P">Perempuan (P)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Status Hubungan</label>
                  <select
                    value={quickHubungan}
                    onChange={(e) => setQuickHubungan(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                  >
                    <option value="KEPALA KELUARGA">KEPALA KELUARGA</option>
                    <option value="ISTERI">ISTERI</option>
                    <option value="ANAK">ANAK</option>
                    <option value="FAMILI LAIN">FAMILI LAIN</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Alamat Domisili / Jalan</label>
                <input
                  type="text"
                  value={quickAlamat}
                  onChange={(e) => setQuickAlamat(e.target.value)}
                  placeholder="Contoh: Jl. Trans Flores Km. 4"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                />
              </div>

              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">RT</label>
                  <input
                    type="text"
                    value={quickRt}
                    onChange={(e) => setQuickRt(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">RW</label>
                  <input
                    type="text"
                    value={quickRw}
                    onChange={(e) => setQuickRw(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kecamatan</label>
                  <input
                    type="text"
                    value={quickKecName}
                    onChange={(e) => setQuickKecName(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl border border-slate-200 font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Desa</label>
                  <input
                    type="text"
                    value={quickDesaName}
                    onChange={(e) => setQuickDesaName(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl border border-slate-200 font-semibold"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowQuickAddDukcapilModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs"
                >
                  Simpan ke Dukcapil & Terapkan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Quick Add Kecamatan */}
      {showQuickAddKecModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-sm">Tambah Kecamatan Baru (Belum Terdaftar)</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowQuickAddKecModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveQuickKec} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Kode Kecamatan</label>
                <input
                  type="text"
                  value={quickKecCode}
                  onChange={(e) => setQuickKecCode(e.target.value)}
                  placeholder="53.16.08"
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nama Kecamatan <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={quickKecNewName}
                  onChange={(e) => setQuickKecNewName(e.target.value)}
                  placeholder="Contoh: Aesesa Selatan"
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold text-slate-900"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowQuickAddKecModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs"
                >
                  Simpan & Gunakan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Quick Add Desa */}
      {showQuickAddDesaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-sm">
                  {quickDesaIsPemekaran ? 'Pemekaran Desa Baru' : 'Tambah Desa (Belum Terdaftar)'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowQuickAddDesaModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveQuickDesa} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Kecamatan Induk</label>
                <div className="p-2.5 rounded-xl bg-slate-100 font-bold text-slate-900 border border-slate-200">
                  {kecamatans.find((k) => k.id === kecamatanId)?.name || 'Kecamatan Terpilih'}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tipe Wilayah</label>
                  <select
                    value={quickDesaType}
                    onChange={(e) => setQuickDesaType(e.target.value as 'Desa' | 'Kelurahan')}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-medium"
                  >
                    <option value="Desa">Desa</option>
                    <option value="Kelurahan">Kelurahan</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kode Desa</label>
                  <input
                    type="text"
                    value={quickDesaCode}
                    onChange={(e) => setQuickDesaCode(e.target.value)}
                    placeholder="53.16.01.2009"
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nama Desa / Kelurahan <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={quickDesaNewName}
                  onChange={(e) => setQuickDesaNewName(e.target.value)}
                  placeholder="Contoh: Tedakisa Timur"
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold text-slate-900"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="pemkQuickCheck"
                  checked={quickDesaIsPemekaran}
                  onChange={(e) => setQuickDesaIsPemekaran(e.target.checked)}
                  className="rounded text-amber-500 focus:ring-amber-500"
                />
                <label htmlFor="pemkQuickCheck" className="font-semibold text-slate-800 cursor-pointer">
                  Tandai sebagai Wilayah Pemekaran Baru
                </label>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Catatan / Keterangan</label>
                <textarea
                  rows={2}
                  value={quickDesaNotes}
                  onChange={(e) => setQuickDesaNotes(e.target.value)}
                  placeholder="Contoh: Desa belum terdaftar pada master awal atau pemekaran desa 2026"
                  className="w-full p-2.5 rounded-xl border border-slate-200"
                ></textarea>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowQuickAddDesaModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-xl shadow-xs"
                >
                  Simpan Desa & Terapkan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Edit Photo Damage Location & Caption */}
      {editingPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-amber-400" />
                <h3 className="font-bold text-sm">Edit Bagian Kerusakan & Keterangan Foto</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingPhoto(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditPhoto} className="p-5 space-y-4 text-xs">
              <div className="w-full h-44 bg-slate-100 rounded-2xl overflow-hidden border border-slate-200 flex items-center justify-center relative">
                <img
                  src={editingPhoto.url}
                  alt={editingPhoto.caption}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-contain"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Bagian Kerusakan Bangunan <span className="text-rose-500">*</span>
                </label>
                <select
                  value={editingPhoto.damageLocation}
                  onChange={(e) =>
                    setEditingPhoto({
                      ...editingPhoto,
                      damageLocation: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-semibold text-slate-900 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                >
                  {STANDARD_DAMAGE_LOCATIONS.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Menentukan label lokasi kerusakan untuk verifikator teknis.
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Deskripsi / Keterangan Kerusakan
                </label>
                <textarea
                  rows={3}
                  value={editingPhoto.caption}
                  onChange={(e) =>
                    setEditingPhoto({
                      ...editingPhoto,
                      caption: e.target.value,
                    })
                  }
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  placeholder="Contoh: Retak geser kolom sudut lantai 1..."
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingPhoto(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-xl shadow-xs cursor-pointer"
                >
                  Simpan Perubahan Foto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LIGHTBOX PHOTO VIEWER MODAL */}
      {previewPhotoIndex !== null && photos[previewPhotoIndex] && (
        <PhotoViewerModal
          photos={photos}
          initialIndex={previewPhotoIndex}
          buildingTitle={`${buildingName || 'Bangunan Gedung'} (Kec. ${kecamatans.find((k) => k.id === kecamatanId)?.name || 'Kecamatan'})`}
          onClose={() => setPreviewPhotoIndex(null)}
        />
      )}
    </form>
  );
};
