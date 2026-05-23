import type { Driver, DriverDocuments, DriverRegistrationRequest } from '@/types';

const verified: DriverDocuments = {
  license:     { status: 'verified', hasLicense: true, number: 'SA-112233', expiryDate: '2027-03-15' },
  customsCard: { status: 'verified' },
  plate:       { status: 'verified', number: 'ABC 1234' },
};

const allPending: DriverDocuments = {
  license:     { status: 'pending', hasLicense: true, number: 'SA-445566' },
  customsCard: { status: 'pending' },
  plate:       { status: 'pending', number: 'XYZ 9876' },
};

const partial: DriverDocuments = {
  license:     { status: 'verified', hasLicense: true, number: 'SA-778899', expiryDate: '2026-11-01' },
  customsCard: { status: 'not_uploaded' },
  plate:       { status: 'not_uploaded' },
};

const rejected: DriverDocuments = {
  license:     { status: 'rejected', hasLicense: true },
  customsCard: { status: 'verified' },
  plate:       { status: 'rejected', number: 'DEF 5678' },
};

const noLicense: DriverDocuments = {
  license:     { status: 'not_uploaded', hasLicense: false },
  customsCard: { status: 'verified' },
  plate:       { status: 'verified', number: 'GHI 3210' },
};

const empty: DriverDocuments = {
  license:     { status: 'not_uploaded', hasLicense: false },
  customsCard: { status: 'not_uploaded' },
  plate:       { status: 'not_uploaded' },
};

const mixed: DriverDocuments = {
  license:     { status: 'verified', hasLicense: true, number: 'SA-001122', expiryDate: '2028-06-30' },
  customsCard: { status: 'rejected' },
  plate:       { status: 'pending', number: 'JKL 7654' },
};

export const mockDrivers: Driver[] = [
  {
    id: 'Driv-1001',
    name: 'Ahmed Al-Khaldi',
    phone: '563009200',
    vehicleModel: 'VEGO Pro 400',
    status: 'inactive',
    trips: 85,
    totalCost: 15.5,
    charges: 76,
    swaps: 42,
    walletBalance: 150.00,
    documents: verified,
  },
  {
    id: 'Driv-1002',
    name: 'Khalid Al-Mutairi',
    phone: '563009200',
    vehicleModel: 'VEGO Cargo 500',
    status: 'active',
    trips: 15,
    totalCost: 15.5,
    charges: 98,
    swaps: 38,
    walletBalance: 45.00,
    documents: allPending,
  },
  {
    id: 'Driv-1003',
    name: 'Saud Al-Harbi',
    phone: '592804512',
    vehicleModel: 'VEGO Pro 400',
    status: 'inactive',
    trips: 70,
    totalCost: 15.5,
    charges: 8,
    swaps: 42,
    walletBalance: 8.50,
    documents: partial,
  },
  {
    id: 'Driv-1004',
    name: 'Fahad Al-Qahtani',
    phone: '530088744',
    vehicleModel: 'VEGO Cargo 500',
    status: 'active',
    trips: 80,
    totalCost: 15.5,
    charges: 65,
    swaps: 42,
    walletBalance: 220.00,
    documents: rejected,
  },
  {
    id: 'Driv-1006',
    name: 'Abdullah Al-Salem',
    phone: '558441499',
    vehicleModel: 'VEGO Pro 400',
    status: 'active',
    trips: 75,
    totalCost: 15.5,
    charges: 45,
    swaps: 42,
    walletBalance: 12.00,
    documents: noLicense,
  },
  {
    id: 'Driv-1007',
    name: 'Majid Al-Ghamdi',
    phone: '506815554',
    vehicleModel: 'VEGO Cargo 500',
    status: 'inactive',
    trips: 95,
    totalCost: 15.5,
    charges: 76,
    swaps: 42,
    walletBalance: 3.00,
    documents: empty,
  },
  {
    id: 'Driv-1009',
    name: 'Yazid Al-Shahri',
    phone: '562527710',
    vehicleModel: 'VEGO Pro 400',
    status: 'inactive',
    trips: 99,
    totalCost: 15.5,
    charges: 38,
    swaps: 42,
    walletBalance: 95.00,
    documents: mixed,
  },
];

const ago = (h: number) =>
  new Date(Date.now() - h * 3_600_000).toISOString();

export const mockPendingRequests: DriverRegistrationRequest[] = [
  {
    id: 'REQ-0001',
    name: 'Omar Al-Rashidi',
    phone: '557001234',
    email: 'omar.rashidi@mail.com',
    requestedAt: ago(2),
    status: 'pending',
    documents: {
      license:     { status: 'pending', hasLicense: true, number: 'SA-334455' },
      customsCard: { status: 'pending' },
      plate:       { status: 'pending', number: 'MNO 2233' },
    },
  },
  {
    id: 'REQ-0002',
    name: 'Rayan Al-Dosari',
    phone: '535009988',
    requestedAt: ago(7),
    status: 'pending',
    documents: {
      license:     { status: 'not_uploaded', hasLicense: false },
      customsCard: { status: 'pending' },
      plate:       { status: 'not_uploaded' },
    },
  },
  {
    id: 'REQ-0003',
    name: 'Turki Al-Anzi',
    phone: '501122334',
    email: 'turki@fleetco.sa',
    requestedAt: ago(24),
    status: 'pending',
    documents: {
      license:     { status: 'not_uploaded', hasLicense: false },
      customsCard: { status: 'not_uploaded' },
      plate:       { status: 'not_uploaded' },
    },
  },
];
