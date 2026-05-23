import type { SwappingStation } from '@/types';

export const mockSwappingStations: SwappingStation[] = [
  { id:'SS-001', cabinetId:'#CF-8821', name:'King Fahd District',  district:'King Fahd Branch Rd',         city:'Riyadh', coordinates:{lat:24.7136,lng:46.6753}, readyBatteries:12, chargingBatteries:5, emptySlots:1, totalCapacity:20, avgWaitTimeMinutes:4,  todaySwaps:124 },
  { id:'SS-002', cabinetId:'#CF-4432', name:'Olaya Hub',            district:'Olaya St, Business District', city:'Riyadh', coordinates:{lat:24.7236,lng:46.6853}, readyBatteries:8,  chargingBatteries:4, emptySlots:1, totalCapacity:15, avgWaitTimeMinutes:7,  todaySwaps:156 },
  { id:'SS-003', cabinetId:'#CF-7751', name:'Al Malqa Station',     district:'Prince Mohammed bin Salman Rd',city:'Riyadh', coordinates:{lat:24.7836,lng:46.6453}, readyBatteries:15, chargingBatteries:2, emptySlots:0, totalCapacity:18, avgWaitTimeMinutes:2,  todaySwaps:156 },
  { id:'SS-004', cabinetId:'#CF-2290', name:'Diplomatic Quarter',   district:'Al Safarat, Riyadh',          city:'Riyadh', coordinates:{lat:24.6836,lng:46.6253}, readyBatteries:6,  chargingBatteries:8, emptySlots:2, totalCapacity:16, avgWaitTimeMinutes:12, todaySwaps:45  },
  { id:'SS-005', cabinetId:'#CF-5563', name:'Granada Center',       district:'Eastern Ring Rd, Ash Shuhada',city:'Riyadh', coordinates:{lat:24.8136,lng:46.7253}, readyBatteries:10, chargingBatteries:3, emptySlots:1, totalCapacity:14, avgWaitTimeMinutes:3,  todaySwaps:132 },
  { id:'SS-006', cabinetId:'#CF-3387', name:'Riyadh Park',          district:'Northern Ring Rd, Al Aqiq',  city:'Riyadh', coordinates:{lat:24.7536,lng:46.6453}, readyBatteries:4,  chargingBatteries:6, emptySlots:2, totalCapacity:12, avgWaitTimeMinutes:15, todaySwaps:67  },
  { id:'SS-007', cabinetId:'#CF-9124', name:'Al Nakheel Plaza',     district:'King Khalid Rd, Al Nakheel', city:'Riyadh', coordinates:{lat:24.7636,lng:46.6953}, readyBatteries:14, chargingBatteries:4, emptySlots:1, totalCapacity:22, avgWaitTimeMinutes:4,  todaySwaps:128 },
  { id:'SS-008', cabinetId:'#CF-6645', name:'Kingdom Tower',        district:'King Fahd Rd, Al Olaya',     city:'Riyadh', coordinates:{lat:24.7113,lng:46.6745}, readyBatteries:3,  chargingBatteries:7, emptySlots:0, totalCapacity:13, avgWaitTimeMinutes:18, todaySwaps:54  },
];
// Totals: ready=72, charging=39, empty=8, capacity=130
