import type { WalletTransaction, WalletStats } from '@/types';

function dt(s: string) { return new Date(s).toISOString(); }

export const mockTransactions: WalletTransaction[] = [
  // --- 23 May ---
  { id: 'TXN-001', createdAt: dt('2026-05-23T14:00'), driverId: 'Driv-1001', driverName: 'Ahmed Al-Khaldi',   amount:  100,   type: 'top_up',       paymentMethod: 'Company Card',  note: 'May top-up',           status: 'completed', adminName: 'John Doe' },
  { id: 'TXN-002', createdAt: dt('2026-05-23T12:30'), driverId: 'Driv-1001', driverName: 'Ahmed Al-Khaldi',   amount:  -15.5, type: 'fast_charge',                                                               status: 'completed' },
  // --- 22 May ---
  { id: 'TXN-003', createdAt: dt('2026-05-22T09:15'), driverId: 'Driv-1002', driverName: 'Khalid Al-Mutairi', amount:  200,   type: 'top_up',       paymentMethod: 'Bank Transfer',                              status: 'completed', adminName: 'John Doe' },
  { id: 'TXN-004', createdAt: dt('2026-05-22T08:00'), driverId: 'Driv-1003', driverName: 'Saud Al-Harbi',     amount:  -12,   type: 'battery_swap',                                                              status: 'completed' },
  // --- 21 May ---
  { id: 'TXN-005', createdAt: dt('2026-05-21T16:45'), driverId: 'Driv-1004', driverName: 'Fahad Al-Qahtani',  amount:  50,    type: 'top_up',       paymentMethod: 'Cash',          note: 'Emergency top-up',     status: 'completed', adminName: 'John Doe' },
  { id: 'TXN-006', createdAt: dt('2026-05-21T10:20'), driverId: 'Driv-1006', driverName: 'Abdullah Al-Salem', amount:  -18,   type: 'fast_charge',                                                               status: 'completed' },
  // --- 20 May ---
  { id: 'TXN-007', createdAt: dt('2026-05-20T15:30'), driverId: 'Driv-1007', driverName: 'Majid Al-Ghamdi',   amount:  150,   type: 'top_up',       paymentMethod: 'Company Card',  note: 'Monthly auto-top-up',  status: 'completed', adminName: 'John Doe' },
  { id: 'TXN-008', createdAt: dt('2026-05-20T09:00'), driverId: 'Driv-1001', driverName: 'Ahmed Al-Khaldi',   amount:  -12,   type: 'battery_swap',                                                              status: 'completed' },
  // --- 19 May ---
  { id: 'TXN-009', createdAt: dt('2026-05-19T11:00'), driverId: 'Driv-1009', driverName: 'Yazid Al-Shahri',   amount:  500,   type: 'top_up',       paymentMethod: 'Company Card',  note: 'Weekly batch',         status: 'completed', adminName: 'John Doe' },
  { id: 'TXN-010', createdAt: dt('2026-05-19T08:30'), driverId: 'Driv-1002', driverName: 'Khalid Al-Mutairi', amount:  -20,   type: 'fast_charge',                                                               status: 'completed' },
  // --- 18 May ---
  { id: 'TXN-011', createdAt: dt('2026-05-18T14:00'), driverId: 'Driv-1003', driverName: 'Saud Al-Harbi',     amount:  800,   type: 'top_up',       paymentMethod: 'Bank Transfer', note: 'Fleet batch top-up',   status: 'completed', adminName: 'John Doe' },
  { id: 'TXN-012', createdAt: dt('2026-05-18T10:15'), driverId: 'Driv-1004', driverName: 'Fahad Al-Qahtani',  amount:  -15,   type: 'battery_swap',                                                              status: 'completed' },
  // --- 17 May ---
  { id: 'TXN-013', createdAt: dt('2026-05-17T09:00'), driverId: 'Driv-1006', driverName: 'Abdullah Al-Salem', amount:  1200,  type: 'top_up',       paymentMethod: 'Company Card',  note: 'Monthly allocation',   status: 'completed', adminName: 'John Doe' },
  { id: 'TXN-014', createdAt: dt('2026-05-17T08:00'), driverId: 'Driv-1007', driverName: 'Majid Al-Ghamdi',   amount:  -22,   type: 'fast_charge',                                                               status: 'completed' },
  // --- 16 May ---
  { id: 'TXN-015', createdAt: dt('2026-05-16T16:00'), driverId: 'Driv-1009', driverName: 'Yazid Al-Shahri',   amount:  -9,    type: 'fast_charge',                                                               status: 'pending' },
  { id: 'TXN-016', createdAt: dt('2026-05-16T11:30'), driverId: 'Driv-1001', driverName: 'Ahmed Al-Khaldi',   amount:  750,   type: 'top_up',       paymentMethod: 'Cash',          note: 'Ahmed May budget',     status: 'completed', adminName: 'John Doe' },
  // --- 15 May ---
  { id: 'TXN-017', createdAt: dt('2026-05-15T13:00'), driverId: 'Driv-1002', driverName: 'Khalid Al-Mutairi', amount:  -25,   type: 'battery_swap',                                                              status: 'completed' },
  { id: 'TXN-018', createdAt: dt('2026-05-15T09:30'), driverId: 'Driv-1003', driverName: 'Saud Al-Harbi',     amount:  -14,   type: 'fast_charge',                                                               status: 'failed' },
  // --- 14 May ---
  { id: 'TXN-019', createdAt: dt('2026-05-14T14:00'), driverId: 'Driv-1004', driverName: 'Fahad Al-Qahtani',  amount:  300,   type: 'top_up',       paymentMethod: 'Bank Transfer',                              status: 'completed', adminName: 'John Doe' },
  { id: 'TXN-020', createdAt: dt('2026-05-14T10:00'), driverId: 'Driv-1006', driverName: 'Abdullah Al-Salem', amount:  -18,   type: 'fast_charge',                                                               status: 'completed' },
];

export const mockWalletStats: WalletStats = {
  totalTopUps:         5_000,
  totalSpent:          3_200,
  avgPerDriver:          320,
  topUpTrend:            12,
  budgetUsedPercent:     84,
  activeDriversCount:    10,
};
