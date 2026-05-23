import type { FastChargingCabinet } from '@/types';

export const mockFastChargingCabinets: FastChargingCabinet[] = [
  { id:'FC-001', cabinetId:'FC-00982', name:'Olaya Hub',           district:'King Fahd Rd, Block 3',          city:'Riyadh', coordinates:{lat:24.7236,lng:46.6853}, availablePorts:5, chargingPorts:2, errorPorts:0, totalPorts:7, avgChargeTimeMinutes:24, todaySessions:67,  status:'operational' },
  { id:'FC-002', cabinetId:'FC-01024', name:'Downtown Station',     district:'Tahlia St, Al Sulimaniyah',      city:'Riyadh', coordinates:{lat:24.6980,lng:46.6842}, availablePorts:3, chargingPorts:2, errorPorts:0, totalPorts:5, avgChargeTimeMinutes:18, todaySessions:58,  status:'high_demand' },
  { id:'FC-003', cabinetId:'FC-01100', name:'North Hub',            district:'Exit 6, Northern Ring Rd',       city:'Riyadh', coordinates:{lat:24.7780,lng:46.7120}, availablePorts:2, chargingPorts:3, errorPorts:0, totalPorts:5, avgChargeTimeMinutes:32, todaySessions:22,  status:'operational' },
  { id:'FC-004', cabinetId:'FC-01231', name:'Al Sahafa Center',     district:'Anas Bin Malik Rd, Al Sahafa',   city:'Riyadh', coordinates:{lat:24.7450,lng:46.6310}, availablePorts:1, chargingPorts:3, errorPorts:1, totalPorts:5, avgChargeTimeMinutes:21, todaySessions:65,  status:'error'       },
  { id:'FC-005', cabinetId:'FC-01380', name:'Exit 15 Station',      district:'Eastern Ring Rd, Riyadh',        city:'Riyadh', coordinates:{lat:24.7060,lng:46.7210}, availablePorts:2, chargingPorts:2, errorPorts:0, totalPorts:4, avgChargeTimeMinutes:15, todaySessions:19,  status:'operational' },
  { id:'FC-006', cabinetId:'FC-01490', name:'University District',  district:'KSU Campus Main Gate',           city:'Riyadh', coordinates:{lat:24.7270,lng:46.6196}, availablePorts:2, chargingPorts:0, errorPorts:0, totalPorts:2, avgChargeTimeMinutes:28, todaySessions:31,  status:'operational' },
];
// Totals: avail=15, charging=12, error=1, totalPorts=28
