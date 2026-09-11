import React, { useState, useEffect, useMemo } from 'react';
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
  MAX_BUILDING_PHOTOS,
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
import { compressImageFile, calculatePhotosPayloadSize } from '../utils/imageCompressor';
import { savePhotoLocally } from '../utils/photoStorage';
import { uploadPhotoToFirebaseStorage } from '../services/firebase';
import { uploadPhotoToServer } from '../utils/photoStorage';
import { checkDuplicateBeforeSave, DuplicateMatchInfo } from '../utils/duplicateDetector';
import { generateNextRegistrationCode, isRegistrationCodeUnique } from '../utils/registrationCodeGenerator';
import { BuildingPhotoGallery } from './BuildingPhotoGallery';
import { PhotoViewerModal } from './PhotoViewerModal';
import { AssessmentDetailModal } from './AssessmentDetailModal';
import { DecimalDamageInputCell } from './DecimalDamageInputCell';
import { AssessmentInputGuideModal } from './AssessmentInputGuideModal';
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
  FileText,
  AlertTriangle,
  ArrowLeft,
  FileSpreadsheet,
  ExternalLink,
  Link2,
  CheckCircle2,
  X,
  Settings,
  Home,
  Printer,
  BookOpen,
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
  Database,
  RefreshCw,
  AlertCircle,
  MessageSquare,
  Lock,
} from 'lucide-react';

export const AssessmentForm: React.FC = () => {
  const {
    assessments,
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
    getCategoryConfig,
  } = useApp();

  const isEditMode = Boolean(selectedAssessmentForEdit);
  const isAdmin = currentUser.role === 'super_admin' || currentUser.role === 'admin';

  // Quick Google Sheet Link Modal state
  const [showSheetModal, setShowSheetModal] = useState(false);
  const [tempSpreadsheetUrl, setTempSpreadsheetUrl] = useState(googleSheetConfig.spreadsheetUrl || '');
  const [tempWebhookUrl, setTempWebhookUrl] = useState(googleSheetConfig.webhookUrl || '');
  const [tempSheetName, setTempSheetName] = useState(googleSheetConfig.sheetName || 'Data_Kerusakan_PUPR');
  const [tempDriveFolderId, setTempDriveFolderId] = useState(googleSheetConfig.driveFolderId || '');

  // Form Fields
  const [code, setCode] = useState<string>(() => {
    if (selectedAssessmentForEdit && selectedAssessmentForEdit.code) {
      return selectedAssessmentForEdit.code;
    }
    return '';
  });

  const isCodeDuplicate = useMemo(() => {
    if (!code || !code.trim()) return false;
    return !isRegistrationCodeUnique(code, assessments, selectedAssessmentForEdit?.id);
  }, [code, assessments, selectedAssessmentForEdit]);
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
  const [targetSheetName, setTargetSheetName] = useState<string>('Kec. Aesesa');
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

  // Panduan Penginputan Lengkap Modal state
  const [showInputGuide, setShowInputGuide] = useState(false);

  // HSBGN and Costing
  const [hsbgnPerM2, setHsbgnPerM2] = useState<number>(getCategoryConfig('Hunian Masyarakat').defaultHsbgn);
  const [demolitionPercent, setDemolitionPercent] = useState<number>(8);

  // Sub-components assessment
  const [components, setComponents] = useState<SubComponentAssessment[]>(getInitialSubComponents());
  const [selectedComponentFilter, setSelectedComponentFilter] = useState<string>('all');

  // Cascading Dropdown States for Component & Sub-Component Selection
  const [cascadeComponent, setCascadeComponent] = useState<string>('Pondasi');
  const [cascadeSubComponentId, setCascadeSubComponentId] = useState<string>('pondasi_1');
  const [cascadeDamageInput, setCascadeDamageInput] = useState<number>(0);

  // Photos State (Maksimal 10 Foto Visual per Bangunan)
  const [photos, setPhotos] = useState<BuildingPhoto[]>([]);
  const [photoInputMethod, setPhotoInputMethod] = useState<'upload' | 'url'>('upload');
  const [newPhotoDamageLocation, setNewPhotoDamageLocation] = useState<string>('Tampak Depan Bangunan');
  const [newPhotoCaption, setNewPhotoCaption] = useState('');
  const [newPhotoUrl, setNewPhotoUrl] = useState('');
  const [isProcessingPhotos, setIsProcessingPhotos] = useState(false);
  const [editingPhoto, setEditingPhoto] = useState<BuildingPhoto | null>(null);
  const [previewPhotoIndex, setPreviewPhotoIndex] = useState<number | null>(null);
  const [previewAssessment, setPreviewAssessment] = useState<BuildingAssessment | null>(null);

  const handleOpenPreviewPdf = () => {
    const currentKec = kecamatans.find((k) => k.id === kecamatanId);
    const currentDesa = desas.find((d) => d.id === desaId);

    const finalOwner = buildingCategory === 'Hunian Masyarakat'
      ? (namaPemilikRumah.trim() || ownerAgency.trim() || 'Pemilik Rumah')
      : (namaPemilikGedung.trim() || ownerAgency.trim() || 'Pengelola Gedung');

    const assessmentPayload: BuildingAssessment = {
      id: isEditMode ? selectedAssessmentForEdit!.id : `assess_preview_${Date.now()}`,
      code: code.trim() || 'REG-PREVIEW',
      disasterType,
      disasterDate,
      assessmentDate,
      buildingName: buildingName.trim() || 'Bangunan Gedung Belum Bernama',
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
      targetSheetName: targetSheetName.trim() || `Kec. ${currentKec?.name || 'Aesesa'}`,
      sourceSheet: targetSheetName.trim() || `Kec. ${currentKec?.name || 'Aesesa'}`,
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
        subTitle: 'Pemerintah Daerah',
        rank: headRank,
        name: headName,
        nip: headNip,
      },
      analysisTeam,

      verificationStatus: isEditMode ? selectedAssessmentForEdit!.verificationStatus : 'Menunggu Verifikasi',
      googleSheetSynced: false,
      createdBy: currentUser.id,
      createdByName: currentUser.name,
      createdAt: isEditMode ? selectedAssessmentForEdit!.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setPreviewAssessment(assessmentPayload);
  };

  // City & Officials
  const [cityLocation, setCityLocation] = useState('Mbay');
  const [reportDateStr, setReportDateStr] = useState('September 2026');
  const [headName, setHeadName] = useState('');
  const [headNip, setHeadNip] = useState('');
  const [headRank, setHeadRank] = useState('');
  const [analysisTeam, setAnalysisTeam] = useState<string[]>([]);

  // Input states for dynamic team member addition
  const [newTeamMemberName, setNewTeamMemberName] = useState('');
  const [newTeamMemberRole, setNewTeamMemberRole] = useState('Surveyor Lapangan');
  const [customTeamRole, setCustomTeamRole] = useState('');

  const handleAddTeamMember = () => {
    const name = newTeamMemberName.trim();
    if (!name) return;
    const role = newTeamMemberRole === 'Lainnya' ? customTeamRole.trim() : newTeamMemberRole;
    const fullEntry = role ? `${name} (${role})` : name;
    if (!analysisTeam.includes(fullEntry)) {
      setAnalysisTeam((prev) => [...prev, fullEntry]);
    }
    setNewTeamMemberName('');
    setCustomTeamRole('');
  };

  const handleRemoveTeamMember = (indexToRemove: number) => {
    setAnalysisTeam((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleAddSelfToTeam = () => {
    const myEntry = `${currentUser.name} (Surveyor Lapangan)`;
    if (!analysisTeam.includes(myEntry)) {
      setAnalysisTeam((prev) => [...prev, myEntry]);
    }
  };

  // Load existing data if edit mode, or auto-generate sequential code for new entry
  useEffect(() => {
    if (selectedAssessmentForEdit) {
      const a = selectedAssessmentForEdit;
      setCode(a.code || generateNextRegistrationCode(assessments));
      const cat = a.buildingCategory || 'Gedung Pemerintah';
      setBuildingCategory(cat);
      setBuildingName(a.buildingName || '');

      const ownerVal = a.namaPemilikRumah || a.namaPemilikGedung || a.ownerAgency || '';
      setNamaPemilikRumah(a.namaPemilikRumah || ownerVal);
      setNamaPemilikGedung(a.namaPemilikGedung || ownerVal);
      setOwnerAgency(a.ownerAgency || ownerVal);

      setDisasterType(a.disasterType || 'Gempa Bumi');
      setDisasterDate(a.disasterDate || new Date().toISOString().slice(0, 10));
      setAssessmentDate(a.assessmentDate || new Date().toISOString().slice(0, 10));
      setYearBuilt(a.yearBuilt && a.yearBuilt > 1900 ? a.yearBuilt : 2018);
      setResponsibleDepartment(a.responsibleDepartment || 'Dinas Pekerjaan Umum dan Penataan Ruang');
      setBuildingClass(a.buildingClass || 'Bangunan Tidak Sederhana');
      setTotalFloorAreaM2(a.totalFloorAreaM2 || 150);
      setNumberOfFloors(a.numberOfFloors || 1);

      // Match kecamatan
      let matchedKecId = a.kecamatanId || '';
      if (a.kecamatanName) {
        const foundKec = kecamatans.find((k) => k.name.toLowerCase().trim() === a.kecamatanName.toLowerCase().trim());
        if (foundKec) matchedKecId = foundKec.id;
      }
      setKecamatanId(matchedKecId || kecamatans[0]?.id || '');

      // Match desa
      let matchedDesaId = a.desaId || '';
      if (a.desaName) {
        const foundDesa = desas.find((d) => d.name.toLowerCase().trim() === a.desaName.toLowerCase().trim());
        if (foundDesa) matchedDesaId = foundDesa.id;
      }
      setDesaId(matchedDesaId);

      setDetailedAddress(a.detailedAddress || '');
      setTargetSheetName(a.targetSheetName || a.sourceSheet || (a.kecamatanName ? `Kec. ${a.kecamatanName}` : 'Kec. Aesesa'));
      setLatitude(a.latitude ?? -8.6754);
      setLongitude(a.longitude ?? 121.3021);
      setHsbgnPerM2(a.hsbgnPerM2 && a.hsbgnPerM2 > 0 ? a.hsbgnPerM2 : getCategoryConfig(cat).defaultHsbgn);
      setDemolitionPercent(a.demolitionPercent ?? 8);

      // Populate subcomponent damage inputs accurately without synthesizing fake identical values
      if (a.components && a.components.length > 0) {
        setComponents(a.components);
      } else {
        setComponents(getInitialSubComponents());
      }
      setPhotos(a.photos || []);
      setNikPemilik(a.nikPemilik || '0');
      setNoKkPemilik(a.noKkPemilik || '0');
      setCityLocation(a.cityLocation || 'Mbay');
      setReportDateStr(a.reportDateStr || 'September 2026');
      setHeadName(a.headOfDepartment?.name || '');
      setHeadNip(a.headOfDepartment?.nip || '');
      setHeadRank(a.headOfDepartment?.rank || '');
      setAnalysisTeam(a.analysisTeam && a.analysisTeam.length > 0 ? a.analysisTeam : []);
    } else {
      // New assessment: ensure code is populated with next sequential code if empty and head officials are empty by default
      setCode((prev) => (prev && prev.trim() ? prev : generateNextRegistrationCode(assessments)));
      setHeadName('');
      setHeadNip('');
      setHeadRank('');
    }
  }, [selectedAssessmentForEdit, assessments, kecamatans, desas]);

  // Current selected kecamatan & desa objects
  const currentKec = kecamatans.find((k) => k.id === kecamatanId);
  const currentDesa = desas.find((d) => d.id === desaId);

  // Filter available desas based on selected kecamatan
  const availableDesas = desas.filter((d) => d.kecamatanId === kecamatanId);

  // Default select first desa and automatically update target sheet when kecamatan changes
  useEffect(() => {
    if (!selectedAssessmentForEdit && availableDesas.length > 0 && (!desaId || !availableDesas.some((d) => d.id === desaId))) {
      setDesaId(availableDesas[0].id);
    }
    const curKec = kecamatans.find((k) => k.id === kecamatanId);
    if (curKec) {
      setTargetSheetName(`Kec. ${curKec.name}`);
    }
  }, [kecamatanId, availableDesas, desaId, selectedAssessmentForEdit, kecamatans]);

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

  const handleSaveQuickKec = (e?: React.FormEvent | React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!quickKecNewName.trim()) {
      showToast('Nama kecamatan wajib diisi!', 'error');
      return;
    }
    const res = addKecamatan({
      code: quickKecCode.trim() || `53.16.${String(kecamatans.length + 1).padStart(2, '0')}`,
      name: quickKecNewName.trim(),
      capitalCity: quickKecNewName.trim(),
    });
    const createdKec = res.kecamatan || res.data;
    if (res.success && createdKec) {
      setKecamatanId(createdKec.id);
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

  const handleSaveQuickDesa = (e?: React.FormEvent | React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
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
    const createdDesa = res.desa || res.data;
    if (res.success && createdDesa) {
      setDesaId(createdDesa.id);
      setShowQuickAddDesaModal(false);
      showToast(res.message, 'success');
    } else {
      showToast(res.message, 'error');
    }
  };

  // Handler when user selects building category
  const handleCategorySelect = (category: BuildingCategory) => {
    setBuildingCategory(category);
    const config = getCategoryConfig(category);
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

      // Guidance: If non-hunian selected and NIK is empty, auto-fill '0' as per standard guideline
      if (category !== 'Hunian Masyarakat') {
        if (!nikPemilik) {
          setNikPemilik('0');
        }
        if (!noKkPemilik) {
          setNoKkPemilik('0');
        }
        if (!namaPemilikGedung) {
          setNamaPemilikGedung('0');
          setOwnerAgency('0');
        }
      } else {
        // If switched back to Hunian and NIK was '0', reset it so user can fill the citizen's NIK
        if (nikPemilik === '0') {
          setNikPemilik('');
        }
        if (noKkPemilik === '0') {
          setNoKkPemilik('');
        }
        if (namaPemilikGedung === '0') {
          setNamaPemilikGedung('');
          setOwnerAgency('');
        }
      }
    }
  };

  const handleApplySampleData = (sample: {
    category: BuildingCategory;
    buildingName: string;
    namaPemilik: string;
    nik: string;
    noKk: string;
  }) => {
    handleCategorySelect(sample.category);
    setBuildingName(sample.buildingName);
    if (sample.category === 'Hunian Masyarakat') {
      setNamaPemilikRumah(sample.namaPemilik);
      setNamaPemilikGedung('');
    } else {
      setNamaPemilikGedung(sample.namaPemilik);
      setNamaPemilikRumah('');
    }
    setOwnerAgency(sample.namaPemilik);
    setNikPemilik(sample.nik);
    setNoKkPemilik(sample.noKk);
    showToast(`Contoh data ${sample.category} diterapkan (NIK: ${sample.nik})!`, 'success');
  };

  const currentCategoryConfig = getCategoryConfig(buildingCategory);

  // Handle component damage input change (supports up to 3 decimal digits)
  const handleComponentChange = (id: string, damageInput: number) => {
    const roundedInput = Math.round(damageInput * 1000) / 1000;
    const clampedInput = Math.max(0, Math.min(100, roundedInput));
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

  // Live duplicate detection as user enters name, location, and owner details
  const liveDuplicateCheck = React.useMemo(() => {
    const currentKec = kecamatans.find((k) => k.id === kecamatanId);
    const currentDesa = desas.find((d) => d.id === desaId);
    return checkDuplicateBeforeSave(
      {
        buildingName,
        kecamatanId,
        kecamatanName: currentKec?.name,
        desaId,
        desaName: currentDesa?.name,
        nikPemilik,
        namaPemilikRumah,
        namaPemilikGedung,
        ownerAgency,
        code,
      },
      assessments,
      selectedAssessmentForEdit?.id
    );
  }, [
    buildingName,
    kecamatanId,
    desaId,
    nikPemilik,
    namaPemilikRumah,
    namaPemilikGedung,
    ownerAgency,
    code,
    kecamatans,
    desas,
    assessments,
    selectedAssessmentForEdit,
  ]);

  const [showDuplicateConfirmModal, setShowDuplicateConfirmModal] = useState(false);
  const [pendingSubmitPayload, setPendingSubmitPayload] = useState<BuildingAssessment | null>(null);

  // Photo Handlers (Maksimal 20 Foto Visual per Bangunan Gedung)
  const handlePhotoFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    if (photos.length >= MAX_BUILDING_PHOTOS) {
      showToast(`Batas maksimal ${MAX_BUILDING_PHOTOS} foto visual per bangunan telah tercapai!`, 'warning');
      return;
    }

    const remainingSlots = MAX_BUILDING_PHOTOS - photos.length;
    const filesToUpload = (Array.from(fileList) as File[]).slice(0, remainingSlots);

    if (fileList.length > remainingSlots) {
      showToast(`Hanya ${remainingSlots} foto yang diproses karena batas kuota ${MAX_BUILDING_PHOTOS} foto.`, 'info');
    }

    setIsProcessingPhotos(true);
    const targetAssId = selectedAssessmentForEdit?.id || (code.trim() ? code.trim() : `draft_${Date.now()}`);

    try {
      // 1. Parallel ultra-fast adaptive compression (compressed concurrently in < 0.3s)
      const compressedResults = await Promise.all(
        filesToUpload.map(async (file, i) => {
          const compressedBase64 = await compressImageFile(file, 750, 750, 0.68);
          const photoId = `photo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${i}`;

          let loc = newPhotoDamageLocation;
          if (!loc || loc === 'Tampak Depan Bangunan') {
            if (photos.length === 0 && i === 0) {
              loc = 'Tampak Depan Bangunan';
            } else {
              loc = newPhotoDamageLocation || 'Struktur - Kolom Praktis / Utama';
            }
          }

          const cap = newPhotoCaption.trim() || `Dokumentasi visual ${loc.toLowerCase()}`;

          // Cache in IndexedDB immediately
          if (compressedBase64) {
            savePhotoLocally(photoId, targetAssId, compressedBase64).catch(() => {});
          }

          return {
            id: photoId,
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
          };
        })
      );

      const validPhotos = compressedResults.filter((p) => !!p.url);

      // 2. Immediately show all photos on screen without waiting for network!
      setPhotos((prev) => [...prev, ...validPhotos]);
      setNewPhotoCaption('');
      showToast(`✓ Berhasil menambahkan ${validPhotos.length} foto kerusakan (${photos.length + validPhotos.length}/${MAX_BUILDING_PHOTOS})`, 'success');

      // 3. Background server disk upload for multi-device & cloud access
      validPhotos.forEach((p) => {
        if (p.id && p.url) {
          uploadPhotoToServer(p.id, targetAssId, p.url).catch(() => {});
        }
      });
    } catch (err) {
      console.error('Gagal proses foto:', err);
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
    if (photos.length >= MAX_BUILDING_PHOTOS) {
      showToast(`Batas maksimal ${MAX_BUILDING_PHOTOS} foto per bangunan telah tercapai!`, 'warning');
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
    showToast(`✓ Foto berhasil ditambahkan (${photos.length + 1}/${MAX_BUILDING_PHOTOS})`, 'success');
  };

  const handleDeletePhoto = (photoId: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    showToast('Foto berhasil dihapus.', 'info');
  };

  const handleSaveEditPhoto = (e?: React.FormEvent | React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
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

    // Ensure valid non-empty registration code (auto-assign if empty)
    let finalCode = code.trim();
    if (!finalCode) {
      finalCode = generateNextRegistrationCode(assessments);
      setCode(finalCode);
      showToast(`No. Registrasi otomatis ditetapkan: ${finalCode}`, 'info');
    }

    const targetAssId = isEditMode
      ? selectedAssessmentForEdit!.id
      : (finalCode.startsWith('REG-') ? finalCode : `REG-${finalCode}`);

    // Ensure photos remain as compressed Base64 to be saved permanently in Firestore
    const syncedPhotos: BuildingPhoto[] = photos;

    const assessmentPayload: BuildingAssessment = {
      id: targetAssId,
      code: finalCode,
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
      targetSheetName: targetSheetName.trim() || `Kec. ${currentKec?.name || 'Aesesa'}`,
      sourceSheet: targetSheetName.trim() || `Kec. ${currentKec?.name || 'Aesesa'}`,
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

      photos: syncedPhotos,
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
        ? (selectedAssessmentForEdit!.verificationStatus === 'Perlu Revisi'
            ? 'Menunggu Verifikasi'
            : selectedAssessmentForEdit!.verificationStatus)
        : 'Menunggu Verifikasi',
      verificationNotes: isEditMode
        ? (selectedAssessmentForEdit!.verificationStatus === 'Perlu Revisi'
            ? `[Revisi Surveyor ${currentUser.name} - ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}]: Data telah diperiksa & diperbaiki.\n(Catatan sebelumnya: ${selectedAssessmentForEdit!.verificationNotes || '-'})`
            : (selectedAssessmentForEdit!.verificationNotes || ''))
        : '',
      verifiedBy: selectedAssessmentForEdit?.verifiedBy,
      verifiedAt: selectedAssessmentForEdit?.verifiedAt,
      googleSheetSynced: false,
      createdBy: currentUser.id,
      createdByName: currentUser.name,
      createdAt: isEditMode ? selectedAssessmentForEdit!.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Save directly into target sheet without blocking or deleting old data
    await executeSaveAssessment(assessmentPayload);
  };

  const executeSaveAssessment = async (payload: BuildingAssessment) => {
    if (isEditMode) {
      if (selectedAssessmentForEdit?.verificationStatus === 'Terverifikasi') {
        showToast(
          'Akses ditolak: Data penilaian ini telah berstatus Terverifikasi dan terkunci resmi dari perubahan.',
          'error'
        );
        return;
      }
      const isRevision = selectedAssessmentForEdit?.verificationStatus === 'Perlu Revisi';
      const res = await updateAssessment(selectedAssessmentForEdit!.id, payload);
      if (res.success && isRevision) {
        showToast(
          '✓ Data berhasil diperbaiki dan status dikembalikan ke "Menunggu Verifikasi" untuk diverifikasi ulang oleh Admin!',
          'success'
        );
      } else {
        showToast(res.message, res.success ? 'success' : 'error');
      }
    } else {
      const res = await addAssessment(payload);
      showToast(res.message, res.success ? 'success' : 'error');
    }

    setShowDuplicateConfirmModal(false);
    setPendingSubmitPayload(null);
    setSelectedAssessmentForEdit(null);
    setActiveTab('penilaian');
  };

  const handleResetScores = () => {
    setComponents(getInitialSubComponents());
    showToast('Tingkat kerusakan semua komponen di-reset ke 0%', 'info');
  };

  return (
    <>
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
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">
                {isEditMode ? 'Edit Penilaian Kerusakan Gedung' : 'Formulir Penilaian Cepat Kerusakan Gedung'}
              </h2>
              {currentUser.role === 'admin_user' && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Mode Surveyor Lapangan
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Format Standar PUPR: Analisis Komponen Pondasi, Struktur, Atap, Dinding, Lantai, Utilitas & Finishing
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowInputGuide(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-amber-950 bg-amber-400 hover:bg-amber-300 border border-amber-500 rounded-xl transition-colors cursor-pointer shadow-xs"
            title="Buka Buku Panduan Penginputan Lengkap Standar PUPR"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-950" />
            <span>Panduan Penginputan Form</span>
          </button>
          <button
            type="button"
            onClick={handleOpenPreviewPdf}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-colors cursor-pointer shadow-xs"
          >
            <Printer className="w-3.5 h-3.5 text-indigo-600" />
            <span>Pratinjau & Cetak PDF</span>
          </button>
          <button
            type="button"
            onClick={handleResetScores}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Nilai</span>
          </button>
          {isEditMode && selectedAssessmentForEdit?.verificationStatus === 'Terverifikasi' ? (
            <div
              title="Data penilaian telah berstatus Terverifikasi resmi dan terkunci dari perubahan."
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-emerald-900 bg-emerald-100 border border-emerald-300 rounded-xl cursor-not-allowed shadow-xs"
            >
              <Lock className="w-4 h-4 text-emerald-700" />
              <span>Terkunci (Terverifikasi)</span>
            </div>
          ) : (
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>
                {isEditMode
                  ? (selectedAssessmentForEdit?.verificationStatus === 'Perlu Revisi'
                      ? 'Simpan & Kirim Ulang ke Verifikator'
                      : 'Simpan Perubahan')
                  : 'Simpan & Hitung'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* TERVERIFIKASI / LOCKED FORM BANNER */}
      {isEditMode && selectedAssessmentForEdit?.verificationStatus === 'Terverifikasi' && (
        <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border-2 border-emerald-400 rounded-2xl p-5 shadow-sm space-y-2 animate-in fade-in">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
              <Lock className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-extrabold text-emerald-950">
                  FORMULIR TERKUNCI: STATUS TELAH "TERVERIFIKASI"
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold border bg-emerald-200 text-emerald-900 border-emerald-400">
                  Resmi Terverifikasi
                </span>
              </div>
              <p className="text-xs text-emerald-900/90 mt-1 leading-relaxed">
                Data penilaian teknis gedung ini telah diverifikasi dan disahkan oleh <strong>{selectedAssessmentForEdit.verifiedBy || 'Tim Verifikator'}</strong>
                {selectedAssessmentForEdit.verifiedAt && (
                  <span> pada {new Date(selectedAssessmentForEdit.verifiedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                )}.
                Untuk menjaga keabsahan dokumen dan rekapitulasi data, seluruh isian penilaian terkunci secara resmi dari perubahan.
              </p>
              {selectedAssessmentForEdit.verificationNotes && (
                <div className="mt-2 p-2.5 bg-white/95 rounded-xl border border-emerald-300 text-xs text-emerald-950">
                  <span className="font-bold">Catatan Verifikator:</span> {selectedAssessmentForEdit.verificationNotes}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* REVISION INSTRUCTION BANNER FROM ADMIN/VERIFIKATOR */}
      {isEditMode && selectedAssessmentForEdit?.verificationNotes && (
        <div className="bg-gradient-to-r from-rose-50 via-amber-50/50 to-rose-50 border-2 border-rose-400 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                <AlertCircle className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-extrabold text-rose-950">
                    CATATAN PERBAIKAN DARI ADMIN / VERIFIKATOR TEKNIS
                  </h3>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                    selectedAssessmentForEdit.verificationStatus === 'Perlu Revisi'
                      ? 'bg-rose-100 text-rose-800 border-rose-300'
                      : 'bg-amber-100 text-amber-800 border-amber-300'
                  }`}>
                    Status: {selectedAssessmentForEdit.verificationStatus}
                  </span>
                </div>
                <p className="text-xs text-rose-800 mt-0.5">
                  Diberikan oleh verifikator <strong>{selectedAssessmentForEdit.verifiedBy || 'Tim Ahli PUPR'}</strong>
                  {selectedAssessmentForEdit.verifiedAt && (
                    <span> pada {new Date(selectedAssessmentForEdit.verifiedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Actual Notes Body */}
          <div className="bg-white/95 border border-rose-300 rounded-xl p-4 text-xs shadow-xs space-y-1.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-rose-800 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-rose-600" />
              <span>Instruksi yang Perlu Diperiksa & Diperbaiki:</span>
            </div>
            <p className="text-sm font-semibold text-slate-800 whitespace-pre-wrap leading-relaxed">
              {selectedAssessmentForEdit.verificationNotes}
            </p>
          </div>

          {/* Action guidance list */}
          <div className="bg-amber-50/90 border border-amber-200 rounded-xl p-3 text-xs text-amber-950 space-y-1">
            <p className="font-bold flex items-center gap-1.5 text-amber-900">
              <CheckCircle2 className="w-4 h-4 text-amber-700" />
              <span>Petunjuk Langkah untuk Petugas Surveyor:</span>
            </p>
            <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-900 ml-1">
              <li>Periksa kembali data komponen gedung, luas lantai, identitas pemilik, atau foto yang disebutkan pada catatan di atas.</li>
              <li>Lakukan perbaikan data pada bagian formulir di bawah ini.</li>
              <li>Setelah perbaikan selesai, klik tombol <strong>"Simpan & Kirim Ulang ke Verifikator"</strong> di kanan atas atau bawah. Status survei akan otomatis diperbarui menjadi <em>Menunggu Verifikasi</em> agar dapat diperiksa ulang oleh Admin.</li>
            </ul>
          </div>
        </div>
      )}

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
              Data penilaian gedung otomatis dikirim & langsung masuk ke tab Sheet <span className="font-bold text-emerald-900">Kecamatan masing-masing ("Kec. {kecamatans.find(k => k.id === kecamatanId)?.name || 'Kecamatan'}")</span> serta Master Rekapitulasi begitu Anda klik Simpan.
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
          {(currentUser.role === 'super_admin' || currentUser.role === 'admin') && (
            <button
              type="button"
              onClick={() => {
                setTempSpreadsheetUrl(googleSheetConfig.spreadsheetUrl || '');
                setTempWebhookUrl(googleSheetConfig.webhookUrl || '');
                setTempSheetName(googleSheetConfig.sheetName || 'Data_Kerusakan_PUPR');
                setShowSheetModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Tentukan Link Sheet</span>
            </button>
          )}
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
                {tempWebhookUrl.includes('drive.google.com') && (
                  <div className="mt-1.5 p-2 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800 flex items-center justify-between gap-2">
                    <span>⚠️ Link Google Drive terdeteksi di kolom Webhook. Pindahkan ke kolom Folder Drive di bawah.</span>
                    <button
                      type="button"
                      onClick={() => {
                        setTempDriveFolderId(tempWebhookUrl);
                        setTempWebhookUrl('');
                      }}
                      className="px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[10px] font-bold shrink-0"
                    >
                      Pindahkan
                    </button>
                  </div>
                )}
                <p className="text-[11px] text-slate-500 mt-1">
                  URL Web App dari Apps Script Google Sheet Anda (Who has access: Anyone) yang langsung menulis baris data baru.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Link / ID Folder Google Drive (Penyimpanan Foto Kerusakan)
                </label>
                <input
                  type="text"
                  value={tempDriveFolderId}
                  onChange={(e) => setTempDriveFolderId(e.target.value)}
                  placeholder="https://drive.google.com/drive/folders/... (atau kosongkan untuk folder default)"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Folder induk Google Drive untuk arsip foto. Bila dikosongkan, folder <strong>SIM-PKBG PUPR - Dokumentasi Foto Kerusakan</strong> akan dibuat otomatis.
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
                  let driveFolder = tempDriveFolderId.trim();

                  if (hookUrl.includes('drive.google.com') && !driveFolder) {
                    driveFolder = hookUrl;
                    hookUrl = '';
                  }
                  if (hookUrl.includes('docs.google.com/spreadsheets') && !sheetUrl) {
                    sheetUrl = hookUrl;
                  }

                  updateGoogleSheetConfig({
                    spreadsheetUrl: sheetUrl,
                    webhookUrl: hookUrl,
                    sheetName: tempSheetName.trim() || 'Data_Kerusakan_PUPR',
                    driveFolderId: driveFolder || undefined,
                    savePhotosToDrive: true,
                    directSaveEnabled: true,
                    autoSync: true,
                    lastTestedAt: new Date().toISOString(),
                    lastTestStatus: 'success',
                    lastTestMessage: 'Link penyimpanan Google Sheet & Google Drive berhasil diperbarui.',
                  });
                  setShowSheetModal(false);
                  showToast('Link Google Sheet & Google Drive berhasil disimpan!', 'success');
                }}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Terapkan Link Sheet</span>
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
              const catConfig = getCategoryConfig(catKey);
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

          {/* Quick Input Guide & NIK Rule Guidance Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border border-amber-300/80 rounded-2xl text-xs shadow-xs">
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold shrink-0 mt-0.5 shadow-xs">
                <BookOpen className="w-4 h-4" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-amber-950">Aturan Resmi NIK & Nama Pemilik:</span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-900 font-bold text-[10px]">
                    Khusus Non-Hunian Di-Nol-kan ("0")
                  </span>
                </div>
                <p className="text-[11px] text-amber-900 mt-0.5 leading-relaxed">
                  Jika kategori <strong>BUKAN Hunian</strong> (Sekolah, Kantor, Toko, Balai, Fasilitas Publik), kepemilikan bukan perorangan sehingga kolom <strong>NIK dan Nama Pemilik dinolkan (isi "0")</strong>. Klik tombol <em>"Nol-kan (0)"</em> yang telah disediakan untuk pengisian instan.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowInputGuide(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs shrink-0 cursor-pointer shadow-xs transition-transform active:scale-95 self-start sm:self-auto whitespace-nowrap"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Lihat Panduan NIK/KK</span>
            </button>
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
          {/* No Registrasi / Kode (Wajib & Otomatis Berurutan) */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                <span>No. Registrasi / Kode Bangunan</span>
                <span className="text-rose-500 font-bold">*</span>
              </label>
              <div className="flex items-center gap-1">
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded border border-emerald-200">
                  Otomatis Berurutan
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const nextCode = generateNextRegistrationCode(assessments);
                    setCode(nextCode);
                    showToast(`✓ Nomor registrasi berurutan berikutnya: ${nextCode}`, 'info');
                  }}
                  className="text-[10px] text-blue-700 bg-blue-100/70 hover:bg-blue-200 px-2 py-0.5 rounded font-semibold cursor-pointer transition-colors"
                  title="Klik untuk menghitung ulang nomor urut berikutnya berdasarkan seluruh data terdaftar"
                >
                  Urutkan Ulang
                </button>
              </div>
            </div>

            <input
              type="text"
              required
              value={code || ''}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Contoh: REG-PUPR-2026-0001"
              className={`w-full px-3 py-2 rounded-lg border font-mono font-bold text-xs transition-colors ${
                isCodeDuplicate
                  ? 'border-rose-400 bg-rose-50 text-rose-900 focus:ring-rose-200'
                  : 'border-slate-300 bg-white text-slate-900 focus:ring-blue-200'
              }`}
            />

            {isCodeDuplicate ? (
              <p className="text-[10px] text-rose-600 font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-rose-500 shrink-0" />
                <span>No. Registrasi ini sudah terdaftar. Klik "Urutkan Ulang" untuk mendapatkan nomor urut unik.</span>
              </p>
            ) : (
              <p className="text-[10px] text-slate-500 flex items-center justify-between">
                <span>Identitas resmi survei sesuai data registrasi.</span>
                <span className="text-[9px] font-mono text-slate-400">REG-PUPR-2026-XXXX</span>
              </p>
            )}
          </div>

          {/* Nama Bangunan */}
          <div className="sm:col-span-2">
            <label className="block font-semibold text-slate-700 mb-1">
              Nama Bangunan <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={buildingName || ''}
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
            <div className="sm:col-span-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <label className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-amber-600" />
                  <span>Kepemilikan Gedung / Instansi Pemilik</span>
                  <span className="text-[10px] text-slate-600 font-semibold px-2 py-0.5 rounded bg-slate-200">
                    {currentCategoryConfig.shortLabel}
                  </span>
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setNamaPemilikGedung('0');
                      setOwnerAgency('0');
                    }}
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                    title="Isi 0 jika tidak ada nama instansi/pemilik spesifik"
                  >
                    <span>Tanpa Nama (0)</span>
                  </button>
                </div>
              </div>

              <input
                type="text"
                list="ownerAgencySuggestions"
                value={namaPemilikGedung || ownerAgency}
                onChange={(e) => {
                  setNamaPemilikGedung(e.target.value);
                  setOwnerAgency(e.target.value);
                }}
                placeholder="Contoh: Pemerintah Desa Podenura / Pemerintah Kabupaten Nagekeo / Dinas Kesehatan"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold text-slate-900 placeholder:text-slate-400 text-xs shadow-2xs"
              />

              <datalist id="ownerAgencySuggestions">
                {desas.find((d) => d.id === desaId)?.name && (
                  <option value={`Pemerintah Desa ${desas.find((d) => d.id === desaId)?.name}`} />
                )}
                <option value="Pemerintah Kabupaten Nagekeo" />
                <option value="Dinas Kesehatan Kabupaten Nagekeo" />
                <option value="Dinas Pendidikan dan Kebudayaan" />
                <option value="Dinas Pekerjaan Umum dan Penataan Ruang" />
                <option value="Yayasan Persekolahan Umat Katolik" />
              </datalist>

              {/* Quick Preset Buttons */}
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="text-[10px] text-slate-400 font-medium">Pilihan Cepat:</span>
                {desas.find((d) => d.id === desaId)?.name && (
                  <button
                    type="button"
                    onClick={() => {
                      const val = `Pemerintah Desa ${desas.find((d) => d.id === desaId)?.name}`;
                      setNamaPemilikGedung(val);
                      setOwnerAgency(val);
                    }}
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 transition-colors cursor-pointer"
                  >
                    + Pemdes {desas.find((d) => d.id === desaId)?.name}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    const val = 'Pemerintah Kabupaten Nagekeo';
                    setNamaPemilikGedung(val);
                    setOwnerAgency(val);
                  }}
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition-colors cursor-pointer"
                >
                  + Pemkab Nagekeo
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const val = 'Dinas Kesehatan';
                    setNamaPemilikGedung(val);
                    setOwnerAgency(val);
                  }}
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 transition-colors cursor-pointer"
                >
                  + Dinkes
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const val = 'Dinas Pendidikan dan Kebudayaan';
                    setNamaPemilikGedung(val);
                    setOwnerAgency(val);
                  }}
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition-colors cursor-pointer"
                >
                  + Dinas P&K
                </button>
              </div>

              <div className="flex items-start gap-1.5 p-2 rounded-lg bg-blue-50/70 border border-blue-100 text-[11px] text-blue-900 leading-normal">
                <Info className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Kepemilikan gedung bisa sama</strong> karena Pemerintah Daerah (Pemda) atau Pemerintah Desa (Pemdes) dapat memiliki lebih dari satu gedung (contoh: Kantor Desa, Balai Desa, Posyandu, Polindes, dsb.).
                </span>
              </div>
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
              value={disasterDate || ''}
              onChange={(e) => setDisasterDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200"
            />
          </div>

          {/* Tanggal Penilaian */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Tanggal Penilaian Lapangan</label>
            <input
              type="date"
              value={assessmentDate || ''}
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
              value={yearBuilt ?? 2018}
              onChange={(e) => setYearBuilt(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 font-medium"
            />
          </div>

          {/* NIK Pemilik */}
          <div className={buildingCategory !== 'Hunian Masyarakat' ? 'p-3 rounded-xl bg-amber-50/70 border border-amber-200/90' : ''}>
            <div className="flex items-center justify-between mb-1">
              <label className="font-semibold text-slate-700 text-xs">
                NIK Pemilik / Penghuni
              </label>
              <div className="flex items-center gap-1.5">
                {buildingCategory !== 'Hunian Masyarakat' ? (
                  <button
                    type="button"
                    onClick={() => {
                      setNikPemilik('0');
                      setNoKkPemilik('0');
                      showToast('NIK & No KK dinolkan ("0") untuk Non-Hunian', 'info');
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold text-amber-900 bg-amber-200/80 hover:bg-amber-300 border border-amber-400 rounded-md cursor-pointer transition-colors"
                    title="Khusus non-hunian: NIK dinolkan ('0')"
                  >
                    <span>Nol-kan (0)</span>
                  </button>
                ) : (
                  <span className="text-[10px] text-slate-400 font-normal">16 Digit Angka</span>
                )}
              </div>
            </div>
            <input
              type="text"
              maxLength={16}
              value={nikPemilik || ''}
              onChange={(e) => setNikPemilik(e.target.value.replace(/\D/g, ''))}
              placeholder={buildingCategory !== 'Hunian Masyarakat' ? "Ketik 0 jika bukan hunian, atau 16 digit NIK" : "Contoh: 5316011504780001"}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-slate-800 text-xs bg-white"
            />
            {buildingCategory !== 'Hunian Masyarakat' ? (
              <p className="text-[10px] text-amber-800 mt-1 font-medium">
                💡 Bangunan non-hunian: NIK dinolkan (cukup isi <strong>"0"</strong>).
              </p>
            ) : (
              <p className="text-[10px] text-slate-400 mt-1">
                Wajib 16 digit angka sesuai KTP untuk rumah tinggal warga.
              </p>
            )}
          </div>

          {/* No KK Pemilik */}
          <div className={buildingCategory !== 'Hunian Masyarakat' ? 'p-3 rounded-xl bg-amber-50/70 border border-amber-200/90' : ''}>
            <div className="flex items-center justify-between mb-1">
              <label className="font-semibold text-slate-700 text-xs">
                Nomor Kartu Keluarga (KK)
              </label>
              <div className="flex items-center gap-1.5">
                {buildingCategory !== 'Hunian Masyarakat' ? (
                  <button
                    type="button"
                    onClick={() => {
                      setNoKkPemilik('0');
                      showToast('No KK dinolkan ("0")', 'info');
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold text-amber-900 bg-amber-200/80 hover:bg-amber-300 border border-amber-400 rounded-md cursor-pointer transition-colors"
                  >
                    <span>Nol-kan (0)</span>
                  </button>
                ) : (
                  <span className="text-[10px] text-slate-400 font-normal">16 Digit Angka</span>
                )}
              </div>
            </div>
            <input
              type="text"
              maxLength={16}
              value={noKkPemilik || ''}
              onChange={(e) => setNoKkPemilik(e.target.value.replace(/\D/g, ''))}
              placeholder={buildingCategory !== 'Hunian Masyarakat' ? "Ketik 0 jika bukan hunian, atau 16 digit KK" : "Contoh: 5316012301050012"}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-slate-800 text-xs bg-white"
            />
            {buildingCategory !== 'Hunian Masyarakat' && (
              <p className="text-[10px] text-amber-800 mt-1 font-medium">
                💡 Bangunan non-hunian: No KK dinolkan (cukup isi <strong>"0"</strong>).
              </p>
            )}
          </div>

          {/* Dinas Teknis */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Dinas Pembina Teknis</label>
            <input
              type="text"
              value={responsibleDepartment || ''}
              onChange={(e) => setResponsibleDepartment(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200"
            />
          </div>

          {/* Kelas Bangunan */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Kelas Bangunan Gedung</label>
            <select
              value={buildingClass || 'Bangunan Tidak Sederhana'}
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
              value={totalFloorAreaM2 ?? 150}
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
              value={numberOfFloors ?? 1}
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
              value={yearBuilt ?? 2018}
              onChange={(e) => setYearBuilt(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-slate-200"
            />
          </div>
        </div>
      </div>

      {/* SECTION 2: Lokasi Wilayah (Kecamatan & Desa Berjenjang) */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-600" />
              <span>II. Lokasi Wilayah Administrasi (Perkecamatan & Desa)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Data penilaian otomatis disinkronkan langsung ke tab sheet kecamatan yang bersangkutan.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('wilayah')}
            className="self-start sm:self-center px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl border border-indigo-200 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="Buka menu data wilayah untuk penambahan atau pemekaran desa baru"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>Kelola Wilayah & Pemekaran</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {/* Kecamatan */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-semibold text-slate-700">
                Kecamatan <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                onClick={handleOpenQuickKec}
                className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 cursor-pointer"
                title="Tambah kecamatan baru jika belum ada di daftar"
              >
                <Plus className="w-3 h-3" />
                <span>Tambah Kec.</span>
              </button>
            </div>
            <select
              value={kecamatanId || ''}
              onChange={(e) => {
                const newKecId = e.target.value;
                setKecamatanId(newKecId);
                const kObj = kecamatans.find((k) => k.id === newKecId);
                if (kObj) {
                  setTargetSheetName(`Kec. ${kObj.name}`);
                }
              }}
              required
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
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
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-semibold text-slate-700">
                Desa / Kelurahan <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => handleOpenQuickDesa(false)}
                className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 cursor-pointer"
                title="Tambah desa yang belum terdaftar di kecamatan ini"
              >
                <Plus className="w-3 h-3" />
                <span>Tambah Desa</span>
              </button>
            </div>
            <select
              value={desaId || ''}
              onChange={(e) => setDesaId(e.target.value)}
              required
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
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
              <span>{availableDesas.length} Desa terdaftar</span>
              <button
                type="button"
                onClick={() => handleOpenQuickDesa(true)}
                className="text-amber-600 hover:underline font-semibold flex items-center gap-0.5 cursor-pointer"
                title="Tambah desa pemekaran baru"
              >
                <Sparkles className="w-2.5 h-2.5" />
                <span>+ Pemekaran</span>
              </button>
            </div>
          </div>

          {/* Alamat Lengkap */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-semibold text-slate-700">Alamat Lengkap / Patokan</label>
            </div>
            <input
              type="text"
              value={detailedAddress || ''}
              onChange={(e) => setDetailedAddress(e.target.value)}
              placeholder="Contoh: RT 02 / RW 01, Jl. Trans Flores Kompleks Pasar"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              RT / RW, Dusun, atau penanda lokasi bangunan
            </p>
          </div>
        </div>

        {/* Indikator Otomatis Masuk ke Tab Google Sheet Sesuai Kecamatan */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-emerald-50/80 border border-emerald-200 rounded-xl text-xs text-emerald-950">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
              <FileSpreadsheet className="w-3.5 h-3.5" />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-slate-600 font-medium">Sheet Google Tujuan:</span>
              <span className="font-bold text-emerald-950 bg-white px-2.5 py-0.5 rounded-md border border-emerald-300 inline-flex items-center gap-1.5 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                {targetSheetName || (currentKec ? `Kec. ${currentKec.name}` : 'Kec. Aesesa')}
              </span>
            </div>
          </div>
          <div className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
            <span>✓ Langsung masuk ke tab sheet kecamatan tanpa perlu memilih manual</span>
          </div>
        </div>

        {/* LIVE DUPLICATE ALERT BANNER (If duplicate is detected in real time) */}
        {!isEditMode && liveDuplicateCheck.isDuplicate && (
          <div className="mt-4 p-4 rounded-2xl bg-amber-500/10 border-2 border-amber-500/40 text-amber-950 space-y-2.5 animate-in fade-in">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-amber-500 text-slate-950 font-bold shrink-0 mt-0.5 shadow-xs">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="font-extrabold text-sm text-amber-950">
                    Peringatan: Potensi Data Survei Ganda Terdeteksi!
                  </h4>
                  <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-950 font-bold text-[10px] border border-amber-300">
                    {liveDuplicateCheck.matches.length} Data Mirip Ditemukan
                  </span>
                </div>
                <p className="text-xs text-amber-900 mt-1 font-medium">
                  {liveDuplicateCheck.primaryMatch?.description}
                </p>

                {/* List of matched existing records */}
                <div className="mt-2.5 space-y-1.5">
                  {liveDuplicateCheck.matches.slice(0, 3).map((match, idx) => (
                    <div
                      key={match.assessment.id || idx}
                      className="p-2.5 bg-white/90 rounded-xl border border-amber-300/70 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs"
                    >
                      <div>
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <span>{match.assessment.buildingName}</span>
                          {match.assessment.code && (
                            <span className="font-mono text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded">
                              {match.assessment.code}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-600 mt-0.5">
                          <span>Kec. {match.assessment.kecamatanName} &bull; Ds. {match.assessment.desaName}</span>
                          {match.assessment.nikPemilik && match.assessment.nikPemilik !== '0' && (
                            <span className="ml-1 font-mono text-[10px] text-slate-500">
                              (NIK: {match.assessment.nikPemilik})
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          Disurvei oleh: <strong>{match.assessment.createdByName || 'Surveyor'}</strong> ({new Date(match.assessment.createdAt || '').toLocaleDateString('id-ID')})
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                        <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 font-bold text-[10px]">
                          {match.reason}
                        </span>
                        <button
                          type="button"
                          onClick={() => setPreviewAssessment(match.assessment)}
                          className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-[10px] cursor-pointer"
                        >
                          Lihat Data
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 3: TABEL BOBOT & TINGKAT KERUSAKAN 8 KOMPONEN PUPR */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Calculator className="w-4 h-4 text-amber-600" />
              <span>III. Analisis Cepat Tingkat Kerusakan Komponen Bangunan (Standar PUPR)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Pilih bagian komponen yang diamati melalui menu pilihan drop-down atau input persentase kerusakan (0% - 100%)
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Live damage badge */}
            <div className="flex items-center gap-2 bg-slate-900 text-white px-3 py-1.5 rounded-xl">
              <span className="text-xs text-slate-300">Total:</span>
              <span className="text-sm font-black text-amber-400">
                {Number(totalDamagePercent ?? 0).toFixed(3)}%
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
        </div>

        {/* Cascading Component & Sub-Component Selector Bar */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-amber-600" />
              <span>Dropdown Bertingkat: Pilih Komponen & Sub Komponen Observasi</span>
            </div>
            <div className="text-[11px] text-slate-500 font-medium">
              Pilih komponen utama dan sub-komponennya untuk input cepat
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-12 gap-3 items-end">
            <div className="xl:col-span-4 sm:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                1. Komponen Bangunan Utama
              </label>
              <select
                value={cascadeComponent}
                onChange={(e) => {
                  const comp = e.target.value;
                  setCascadeComponent(comp);
                  const subs = PUPR_MASTER_COMPONENTS.filter((c) => c.componentName === comp);
                  if (subs.length > 0) {
                    setCascadeSubComponentId(subs[0].id);
                    const matchedComp = components.find(x => x.id === subs[0].id);
                    if (matchedComp) {
                      setCascadeDamageInput(matchedComp.damagePercentInput);
                    }
                  }
                }}
                className="w-full h-10 px-3 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 cursor-pointer truncate"
              >
                {Array.from(new Set(PUPR_MASTER_COMPONENTS.map((c) => c.componentName))).map((compName) => (
                  <option key={compName} value={compName}>
                    {compName}
                  </option>
                ))}
              </select>
            </div>

            <div className="xl:col-span-4 sm:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                2. Sub Komponen (Menyesuaikan Otomatis)
              </label>
              <select
                value={cascadeSubComponentId}
                onChange={(e) => {
                  const subId = e.target.value;
                  setCascadeSubComponentId(subId);
                  const matchedComp = components.find(x => x.id === subId);
                  if (matchedComp) {
                    setCascadeDamageInput(matchedComp.damagePercentInput);
                  }
                }}
                className="w-full h-10 px-3 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 cursor-pointer truncate"
              >
                {PUPR_MASTER_COMPONENTS.filter((c) => c.componentName === cascadeComponent).map((sub) => {
                  const currentCompState = components.find(x => x.id === sub.id);
                  const currentVal = currentCompState ? currentCompState.damagePercentInput : 0;
                  return (
                    <option key={sub.id} value={sub.id}>
                      {sub.subComponentName} (Bobot: {Number(sub.bobotPercent ?? 0).toFixed(2)}% | Saat ini: {currentVal}%)
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="xl:col-span-2 sm:col-span-1">
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                3. Tingkat Kerusakan
              </label>
              <div className="flex items-center gap-1.5">
                <select
                  value={cascadeDamageInput}
                  onChange={(e) => setCascadeDamageInput(parseFloat(e.target.value) || 0)}
                  className="flex-1 min-w-0 h-10 px-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 cursor-pointer"
                >
                  <option value={0}>0%</option>
                  <option value={5}>5%</option>
                  <option value={10}>10%</option>
                  <option value={15}>15%</option>
                  <option value={20}>20%</option>
                  <option value={25}>25%</option>
                  <option value={30}>30%</option>
                  <option value={40}>40%</option>
                  <option value={50}>50%</option>
                  <option value={75}>75%</option>
                  <option value={100}>100%</option>
                  {![0, 5, 10, 15, 20, 25, 30, 40, 50, 75, 100].includes(cascadeDamageInput) && (
                    <option value={cascadeDamageInput}>{cascadeDamageInput}%</option>
                  )}
                </select>
                <div className="flex items-center h-10 bg-white border border-slate-300 rounded-xl px-2 focus-within:ring-2 focus-within:ring-amber-500 shrink-0 w-19">
                  <DecimalDamageInputCell
                    value={cascadeDamageInput}
                    onChange={(val) => setCascadeDamageInput(val)}
                    className="w-full border-0 p-0 shadow-none focus:ring-0 text-xs font-bold text-slate-900 text-center"
                  />
                  <span className="text-[11px] text-slate-400 font-bold ml-0.5">%</span>
                </div>
              </div>
            </div>

            <div className="xl:col-span-2 sm:col-span-1">
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                4. Aksi
              </label>
              <button
                type="button"
                onClick={() => {
                  if (cascadeSubComponentId) {
                    handleComponentChange(cascadeSubComponentId, cascadeDamageInput);
                    const targetSub = PUPR_MASTER_COMPONENTS.find(s => s.id === cascadeSubComponentId);
                    showToast(`Kerusakan pada ${targetSub?.subComponentName || cascadeComponent} berhasil diperbarui (${cascadeDamageInput}%)!`, 'success');
                  }
                }}
                className="w-full h-10 px-4 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Check className="w-4 h-4 text-slate-950 shrink-0" />
                <span>Terapkan</span>
              </button>
            </div>
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
                <th className="py-2.5 px-3 text-center w-56">INPUT KERUSAKAN (%)</th>
                <th className="py-2.5 px-3 text-right w-28">NILAI (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {components.map((c, index) => {
                const isNewGroup =
                  index === 0 || c.componentNo !== components[index - 1]?.componentNo;

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
                        {Number(c.bobotPercent ?? 0).toFixed(2)}%
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-400 font-mono">
                        {Number(c.kerusakanMaxPercent ?? 0).toFixed(2)}%
                      </td>
                      <td className="py-2 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <select
                            value={c.damagePercentInput}
                            onChange={(e) =>
                              handleComponentChange(c.id, parseFloat(e.target.value) || 0)
                            }
                            className="px-2 py-1 text-xs font-bold rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white cursor-pointer"
                          >
                            <option value={0}>0% (Baik)</option>
                            <option value={5}>5% (Sangat Ringan)</option>
                            <option value={10}>10% (Ringan Sekali)</option>
                            <option value={15}>15% (Ringan)</option>
                            <option value={20}>20% (Ringan Sedang)</option>
                            <option value={25}>25% (Cukup Ringan)</option>
                            <option value={30}>30% (Sedang)</option>
                            <option value={40}>40% (Sedang Berat)</option>
                            <option value={50}>50% (Berat)</option>
                            <option value={75}>75% (Berat Sekali)</option>
                            <option value={100}>100% (Total / Runtuh)</option>
                            {![0, 5, 10, 15, 20, 25, 30, 40, 50, 75, 100].includes(c.damagePercentInput) && (
                              <option value={c.damagePercentInput}>
                                {c.damagePercentInput}% (Kustom)
                              </option>
                            )}
                          </select>
                          <DecimalDamageInputCell
                            value={c.damagePercentInput}
                            onChange={(val) => handleComponentChange(c.id, val)}
                          />
                          <span className="text-slate-400 font-semibold">%</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900 font-mono">
                        {Number(c.calculatedScore ?? 0).toFixed(3)}%
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
                  {Number(totalDamagePercent ?? 0).toFixed(3)}%
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
                  {isAdmin ? <span className="text-xs font-normal text-amber-800 ml-1">(Dapat disesuaikan standar daerah)</span> : <span className="text-xs font-normal text-rose-600 ml-1">(Terkunci untuk Surveyor)</span>}
                </label>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setHsbgnPerM2(currentCategoryConfig.defaultHsbgn)}
                    className="text-[11px] font-semibold text-amber-800 hover:text-amber-950 underline"
                  >
                    Kategori {currentCategoryConfig.shortLabel} (Rp {formatRupiah(currentCategoryConfig.defaultHsbgn)})
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 mb-2">
                <span className="font-bold text-slate-500">Rp</span>
                <input
                  type="number"
                  step={50000}
                  disabled={!isAdmin}
                  value={hsbgnPerM2}
                  onChange={(e) => setHsbgnPerM2(Number(e.target.value))}
                  className={`w-full px-3 py-2 rounded-xl border border-slate-200 font-bold ${isAdmin ? 'text-slate-900 bg-white shadow-sm' : 'text-slate-500 bg-slate-100 cursor-not-allowed'}`}
                />
              </div>
              {/* Quick Regional HSBGN Presets - Only for Admin/Super Admin */}
              {isAdmin ? (
                <div className="flex flex-wrap gap-1.5 items-center text-[11px]">
                  <span className="text-slate-500 font-medium">Ubah Standar HSBGN Daerah?</span>
                  <button
                    type="button"
                    onClick={() => setActiveTab('hsbgn_settings')}
                    className="px-3 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-md transition-colors border border-amber-200/60 shadow-xs font-bold"
                  >
                    Buka Menu Standar HSBGN
                  </button>
                </div>
              ) : null}
              <p className="text-[11px] text-slate-500 mt-1">
                {isAdmin 
                  ? "*Nilai ini otomatis terisi dari Pengaturan HSBGN Daerah. Anda tetap bisa menyesuaikan khusus untuk data gedung ini."
                  : "Harga satuan HSBGN ditentukan oleh Admin/Super Admin. Anda masuk sebagai Surveyor dan menggunakan standar yang telah ditetapkan."}
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
                {Number(totalDamagePercent ?? 0).toFixed(3)}%
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
              value={cityLocation || ''}
              onChange={(e) => setCityLocation(e.target.value)}
              placeholder="Contoh: Mbay, Seba, Kupang"
              className="w-full px-3 py-2 rounded-xl border border-slate-200"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Bulan & Tahun Dokumen</label>
            <input
              type="text"
              value={reportDateStr || ''}
              onChange={(e) => setReportDateStr(e.target.value)}
              placeholder="Contoh: Agustus 2026"
              className="w-full px-3 py-2 rounded-xl border border-slate-200"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Nama Kepala Dinas PUPR</label>
            <input
              type="text"
              value={headName || ''}
              onChange={(e) => setHeadName(e.target.value)}
              placeholder="Kosongkan jika belum ada / diisi saat pengesahan"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 font-semibold text-slate-900"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">NIP Kepala Dinas</label>
            <input
              type="text"
              value={headNip || ''}
              onChange={(e) => setHeadNip(e.target.value)}
              placeholder="NIP Pejabat"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-slate-900"
            />
          </div>
        </div>
      </div>

      {/* SECTION VI: Dokumentasi Foto Visual Kerusakan Fisik Bangunan (Maksimal 20 Foto) */}
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
                    photos.length >= MAX_BUILDING_PHOTOS
                      ? 'bg-rose-100 text-rose-700 border border-rose-300'
                      : photos.length > 0
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}
                >
                  {photos.length} / {MAX_BUILDING_PHOTOS} Foto Terunggah
                </span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Maksimal {MAX_BUILDING_PHOTOS} foto visual per satu bangunan gedung/rumah. Foto disimpan aman di Firebase Cloud Storage & Firestore. Wajib menentukan bagian kerusakan agar verifikator teknis mengetahui detail lokasi foto.
              </p>
              {photos.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 mt-2 pt-1.5 border-t border-slate-100 text-[11px]">
                  {(() => {
                    const info = calculatePhotosPayloadSize(photos);
                    return (
                      <>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium ${
                          info.isSafe 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}>
                          <Database className="w-3 h-3 text-emerald-600" />
                          <span>Firestore Payload: {info.formatted} / 1 MB ({info.isSafe ? 'Aman' : 'Peringatan'})</span>
                        </span>
                        {info.cloudCount > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 font-medium">
                            <UploadCloud className="w-3 h-3 text-indigo-600" />
                            <span>{info.cloudCount} Foto di Firebase Storage</span>
                          </span>
                        )}
                        {info.base64Count > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-medium">
                            <span>{info.base64Count} Foto Terkompresi Lokal</span>
                          </span>
                        )}
                      </>
                    );
                  })()}
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-200 font-medium">
                    <UploadCloud className="w-3 h-3 text-sky-600" />
                    <span>Google Drive: Folder Arsip per Bangunan</span>
                  </span>
                  {selectedAssessmentForEdit?.googleDriveFolderUrl && (
                    <a
                      href={selectedAssessmentForEdit.googleDriveFolderUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-medium transition-colors"
                      title="Buka folder dokumentasi foto gedung ini di Google Drive"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Buka Google Drive</span>
                    </a>
                  )}
                </div>
              )}
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
              {MAX_BUILDING_PHOTOS - photos.length > 0 ? (
                <span>Tersedia kuota <strong>{MAX_BUILDING_PHOTOS - photos.length} foto</strong> lagi</span>
              ) : (
                <span className="text-rose-600 font-bold">Batas {MAX_BUILDING_PHOTOS} foto penuh</span>
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
                  photos.length >= MAX_BUILDING_PHOTOS
                    ? 'border-slate-200 bg-slate-100/60 opacity-60 cursor-not-allowed'
                    : 'border-amber-300 bg-amber-50/40 hover:bg-amber-50/80 hover:border-amber-400'
                }`}
              >
                <div className="flex flex-col items-center text-center space-y-1.5">
                  <div className="p-3 rounded-full bg-amber-500/10 text-amber-600">
                    {isProcessingPhotos ? (
                      <RefreshCw className="w-6 h-6 animate-spin text-amber-600" />
                    ) : (
                      <Camera className="w-6 h-6" />
                    )}
                  </div>
                  <div className="text-xs font-bold text-slate-800">
                    {isProcessingPhotos ? (
                      <span className="text-amber-600 animate-pulse font-bold">
                        Sedang mengompresi foto sekejap secara paralel...
                      </span>
                    ) : photos.length >= MAX_BUILDING_PHOTOS ? (
                      <span className="text-slate-500">Batas kuota {MAX_BUILDING_PHOTOS} foto telah terpenuhi</span>
                    ) : (
                      <span>Pilih Foto dari Galeri HP / Kamera / Komputer (Bisa Pilih Sekaligus s/d {MAX_BUILDING_PHOTOS} Foto)</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Mendukung semua format foto: <strong>JPG, JPEG, PNG, WEBP, HEIC/HEIF (iPhone/Apple), BMP, GIF, TIFF, AVIF</strong>. Kompresi paralel kilat &amp; sinkronisasi awan otomatis.
                  </p>
                </div>
                <input
                  type="file"
                  accept="image/*, .heic, .heif, .jpg, .jpeg, .png, .webp, .bmp, .gif, .tiff, .tif, .avif"
                  multiple
                  disabled={photos.length >= MAX_BUILDING_PHOTOS || isProcessingPhotos}
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
                disabled={photos.length >= MAX_BUILDING_PHOTOS}
                className="flex-1 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-mono"
              />
              <button
                type="button"
                onClick={handleAddUrlPhoto}
                disabled={photos.length >= MAX_BUILDING_PHOTOS || !newPhotoUrl.trim()}
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
            onEditPhoto={(p) =>
              setEditingPhoto({
                ...p,
                damageLocation: p.damageLocation || STANDARD_DAMAGE_LOCATIONS[0],
                caption: p.caption || '',
              })
            }
            onSelectPhoto={(idx) => setPreviewPhotoIndex(idx)}
          />
        </div>
      </div>

      {/* SECTION VII: TIM LAPANGAN & PENGESAHAN LAPORAN (STANDAR PUPR) */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-100">
              <Users className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                VII. Tim Lapangan & Lembar Pengesahan Dokumen (PUPR)
              </h3>
              <p className="text-xs text-slate-500">
                Input personil tim surveyor lapangan yang melakukan verifikasi/penilaian teknis dan rincian pejabat penandatangan.
              </p>
            </div>
          </div>
        </div>

        {/* 1. Input Tim Lapangan Dinamis */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
              Personil Tim Lapangan ({analysisTeam.length} Orang Terdaftar)
            </label>
            <button
              type="button"
              onClick={handleAddSelfToTeam}
              className="text-xs text-indigo-600 hover:text-indigo-700 font-bold flex items-center gap-1 cursor-pointer self-start sm:self-auto"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>+ Masukkan Akun Saya ({currentUser.name})</span>
            </button>
          </div>

          {/* Form baris tambah anggota */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
            <div className="sm:col-span-6">
              <input
                type="text"
                value={newTeamMemberName}
                onChange={(e) => setNewTeamMemberName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTeamMember();
                  }
                }}
                placeholder="Nama Lengkap Petugas & Gelar (cth: Yoseph Lado, A.Md.T.)"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
            </div>
            <div className="sm:col-span-4">
              <select
                value={newTeamMemberRole}
                onChange={(e) => setNewTeamMemberRole(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white font-semibold text-slate-700"
              >
                <option value="Surveyor Lapangan">Surveyor Lapangan</option>
                <option value="Ketua Tim Teknis">Ketua Tim Teknis</option>
                <option value="Ahli Struktur">Ahli Struktur</option>
                <option value="Ahli Arsitektur">Ahli Arsitektur</option>
                <option value="Estimator Anggaran">Estimator Anggaran</option>
                <option value="Verifikator Teknis TABG">Verifikator Teknis TABG</option>
                <option value="Perangkat Desa / Saksi">Perangkat Desa / Saksi</option>
                <option value="Lainnya">Peran Lainnya...</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <button
                type="button"
                onClick={handleAddTeamMember}
                disabled={!newTeamMemberName.trim()}
                className="w-full h-full py-2 px-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah</span>
              </button>
            </div>
            {newTeamMemberRole === 'Lainnya' && (
              <div className="sm:col-span-12 mt-1">
                <input
                  type="text"
                  value={customTeamRole}
                  onChange={(e) => setCustomTeamRole(e.target.value)}
                  placeholder="Ketik peran kustom tim lapangan (cth: Staf Pendamping Bencana)"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-900"
                />
              </div>
            )}
          </div>

          {/* List anggota tim lapangan */}
          {analysisTeam.length === 0 ? (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-center">
              <p className="text-xs text-slate-500 font-medium">
                Belum ada personil tim lapangan yang diinput. Gunakan form di atas untuk memasukkan nama personil yang bertugas agar tercetak resmi di dokumen laporan.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {analysisTeam.map((member, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 shadow-2xs text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 font-bold text-[10px] flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <span className="font-semibold text-slate-900 truncate">{member}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveTeamMember(idx)}
                    className="text-slate-400 hover:text-rose-600 p-1 transition-colors cursor-pointer"
                    title="Hapus personil"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 2. Informasi Pejabat Pengesah Laporan */}
        <div className="pt-4 border-t border-slate-100">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
            Pengesahan Dokumen / Pejabat Penandatangan
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nama Kepala Dinas / Pejabat</label>
              <input
                type="text"
                value={headName || ''}
                onChange={(e) => setHeadName(e.target.value)}
                placeholder="Contoh: Dionisius T. Ndolu, S.T., M.Si."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 font-medium text-slate-900"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">NIP Pejabat</label>
              <input
                type="text"
                value={headNip || ''}
                onChange={(e) => setHeadNip(e.target.value)}
                placeholder="Contoh: 19740512 200212 1 004"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-slate-900"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Pangkat / Golongan</label>
              <input
                type="text"
                value={headRank || ''}
                onChange={(e) => setHeadRank(e.target.value)}
                placeholder="Contoh: Pembina TK I"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Kota Tempat Pelaporan</label>
              <input
                type="text"
                value={cityLocation || ''}
                onChange={(e) => setCityLocation(e.target.value)}
                placeholder="Contoh: Mbay"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Bulan & Tahun Dokumen Pelaporan</label>
              <input
                type="text"
                value={reportDateStr || ''}
                onChange={(e) => setReportDateStr(e.target.value)}
                placeholder="Contoh: September 2026"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900"
              />
            </div>
          </div>
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
        {isEditMode && selectedAssessmentForEdit?.verificationStatus === 'Terverifikasi' ? (
          <div
            title="Data penilaian telah berstatus Terverifikasi resmi dan terkunci dari perubahan."
            className="flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-emerald-900 bg-emerald-100 border border-emerald-300 rounded-xl cursor-not-allowed shadow-xs"
          >
            <Lock className="w-4 h-4 text-emerald-700" />
            <span>Formulir Terkunci (Terverifikasi)</span>
          </div>
        ) : (
          <button
            type="submit"
            className="flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-xl shadow-md shadow-amber-500/20 transition-all cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>
              {isEditMode
                ? (selectedAssessmentForEdit?.verificationStatus === 'Perlu Revisi'
                    ? 'Simpan & Kirim Ulang ke Verifikator'
                    : 'Simpan Perubahan Penilaian')
                : 'Simpan & Sinkronkan Data'}
            </span>
          </button>
        )}
      </div>
      </form>

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

            <div className="p-6 space-y-4 text-xs">
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
                  type="button"
                  onClick={handleSaveQuickDukcapil}
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs cursor-pointer"
                >
                  Simpan ke Dukcapil & Terapkan
                </button>
              </div>
            </div>
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

            <div className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Kode Kecamatan</label>
                <input
                  type="text"
                  value={quickKecCode}
                  onChange={(e) => setQuickKecCode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSaveQuickKec(e);
                    }
                  }}
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
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSaveQuickKec(e);
                    }
                  }}
                  placeholder="Contoh: Aesesa Selatan"
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold text-slate-900"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowQuickAddKecModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveQuickKec}
                  className="px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs cursor-pointer"
                >
                  Simpan & Gunakan
                </button>
              </div>
            </div>
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

            <div className="p-6 space-y-4 text-xs">
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
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSaveQuickDesa(e);
                      }
                    }}
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
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSaveQuickDesa(e);
                    }
                  }}
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
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveQuickDesa}
                  className="px-5 py-2 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-xl shadow-xs cursor-pointer"
                >
                  Simpan Desa & Terapkan
                </button>
              </div>
            </div>
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

            <div className="p-5 space-y-4 text-xs">
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
                  value={editingPhoto.damageLocation || STANDARD_DAMAGE_LOCATIONS[0]}
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
                  value={editingPhoto.caption || ''}
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
                  type="button"
                  onClick={handleSaveEditPhoto}
                  className="px-5 py-2 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-xl shadow-xs cursor-pointer"
                >
                  Simpan Perubahan Foto
                </button>
              </div>
            </div>
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

      {/* OFFICIAL PUPR PDF PREVIEW MODAL */}
      {previewAssessment && (
        <AssessmentDetailModal
          assessment={previewAssessment}
          onClose={() => setPreviewAssessment(null)}
        />
      )}

      {/* PANDUAN PENGINPUTAN LENGKAP STANDAR PUPR */}
      <AssessmentInputGuideModal
        isOpen={showInputGuide}
        onClose={() => setShowInputGuide(false)}
        onApplySampleData={handleApplySampleData}
      />

      {/* MODAL KONFIRMASI DATA GANDA SEBELUM DISIMPAN */}
      {showDuplicateConfirmModal && pendingSubmitPayload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-amber-300">
            <div className="px-6 py-4 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-slate-950 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-slate-950 text-amber-400 rounded-xl">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-950">Konfirmasi Penyimpanan Data Ganda</h3>
                  <p className="text-[11px] text-amber-950 font-semibold">Peringatan Duplikasi Survei Lapangan</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowDuplicateConfirmModal(false);
                  setPendingSubmitPayload(null);
                }}
                className="text-slate-900 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 text-amber-950 leading-relaxed space-y-1">
                <p className="font-bold text-xs">
                  Sistem mendeteksi bahwa bangunan gedung ini kemungkinan sudah pernah disurvei dan tersimpan di database:
                </p>
                <p className="text-[11px] text-amber-900">
                  {liveDuplicateCheck.primaryMatch?.description}
                </p>
              </div>

              {/* Duplicate Target Detail comparison */}
              <div className="space-y-2">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Data yang Sudah Ada di Database:
                </div>
                {liveDuplicateCheck.matches.slice(0, 2).map((match, idx) => (
                  <div
                    key={match.assessment.id || idx}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1 text-slate-700"
                  >
                    <div className="font-bold text-slate-900 flex items-center justify-between">
                      <span>{match.assessment.buildingName}</span>
                      <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-bold">
                        {match.reason}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600">
                      Kecamatan: <strong>{match.assessment.kecamatanName}</strong> &bull; Desa: <strong>{match.assessment.desaName}</strong>
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Disurvei oleh: <strong>{match.assessment.createdByName}</strong> pada {new Date(match.assessment.createdAt || '').toLocaleDateString('id-ID')}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 bg-slate-100 rounded-xl text-[11px] text-slate-600 space-y-1">
                <p>
                  💡 <strong>Informasi Kepemilikan:</strong> Kepemilikan gedung bisa sama karena Pemerintah Daerah (Pemda) atau Pemerintah Desa (Pemdes) dapat memiliki lebih dari satu gedung (contoh: Kantor Desa, Balai Desa, Posyandu, Polindes, dsb.).
                </p>
                <p>
                  Jika Anda yakin ini adalah objek gedung yang berbeda fisik atau penilaian tahap lanjutan, Anda dapat melanjutkan penyimpanan sebagai gedung baru yang sah.
                </p>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowDuplicateConfirmModal(false);
                    setPendingSubmitPayload(null);
                  }}
                  className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer transition-colors text-center"
                >
                  Batal & Periksa Kembali
                </button>
                <button
                  type="button"
                  onClick={() => executeSaveAssessment(pendingSubmitPayload)}
                  className="w-full sm:w-auto px-5 py-2.5 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-xl shadow-sm cursor-pointer transition-colors text-center flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Tetap Simpan Sebagai Data Baru</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
