require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Import all models
const Brand = require('./models/Brand');
const Category = require('./models/Categories');
const SubCategory = require('./models/SubCategory');
const Model = require('./models/Model');
const Year = require('./models/Year');
const Fuel = require('./models/Fuel');
const User = require('./models/User');
const { Shop } = require('./models/Shop');
const PartsCatalog = require('./models/PartsCatalog');
const ShopProduct = require('./models/ShopProduct');
const { DeliveryAgency } = require('./models/DeliveryAgency');
const DeliveryBoy = require('./models/DeliveryBoy');
const Banner = require('./models/Banners');
const Coupon = require('./models/Coupon');
const Offers = require('./models/Offers');
const VehicleConfiguration = require('./models/VehicleConfiguration');
const Engine = require('./models/Engine');
const Transmission = require('./models/Transmission');
const { VinData } = require('./models/VinData');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB connected');
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  }
};

const clearDatabase = async () => {
  console.log('\n🗑️  Clearing database...');
  
  const collections = [
    'brands', 'categories', 'subcategories', 'models', 'years', 'fuels',
    'users', 'shops', 'partscatalogs', 'shopproducts', 'deliveryagencies',
    'deliveryboys', 'banners', 'coupons', 'offers', 'orders', 'carts',
    'wishlists', 'payments', 'invoices', 'notifications', 'stocks', 'vehicleconfigurations',
    'engines', 'transmissions', 'groups', 'parts', 'reviews', 'vindatas', 'cars'
  ];

  for (const collectionName of collections) {
    try {
      const collection = mongoose.connection.collection(collectionName);
      const result = await collection.deleteMany({});
      console.log(`   ✓ Cleared ${collectionName}: ${result.deletedCount} documents`);
    } catch (err) {
      console.log(`   ⚠ Skipped ${collectionName} (may not exist)`);
    }
  }
  
  console.log('✅ Database cleared\n');
};

// Helper functions
const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomFloat = (min, max) => Math.random() * (max - min) + min;

// Real-world car brands and models data
const realWorldCarData = [
  // Toyota (20 models)
  { brand: 'Toyota', models: ['Camry', 'Corolla', 'RAV4', 'Highlander', 'Prius', 'Avalon', 'Sienna', 'Tacoma', 'Tundra', '4Runner', 'Sequoia', 'Land Cruiser', 'Yaris', 'C-HR', 'Venza', 'GR Supra', 'GR86', 'bZ4X', 'Crown', 'Mirai'] },
  // Honda (18 models)
  { brand: 'Honda', models: ['Accord', 'Civic', 'CR-V', 'Pilot', 'Odyssey', 'Passport', 'Ridgeline', 'HR-V', 'Insight', 'Clarity', 'Fit', 'Pilot', 'Element', 'S2000', 'NSX', 'Ridgeline', 'Element', 'Prelude'] },
  // Nissan (18 models)
  { brand: 'Nissan', models: ['Altima', 'Sentra', 'Maxima', 'Rogue', 'Pathfinder', 'Armada', 'Frontier', 'Titan', 'Murano', 'Kicks', 'Versa', 'Leaf', '370Z', 'GT-R', 'Juke', 'Quest', 'Xterra', 'Cube'] },
  // Ford (16 models)
  { brand: 'Ford', models: ['F-150', 'Mustang', 'Explorer', 'Escape', 'Edge', 'Expedition', 'Ranger', 'Bronco', 'Fusion', 'Focus', 'Taurus', 'EcoSport', 'Transit', 'Fiesta', 'Flex', 'GT'] },
  // Chevrolet (16 models)
  { brand: 'Chevrolet', models: ['Silverado', 'Tahoe', 'Equinox', 'Traverse', 'Suburban', 'Malibu', 'Impala', 'Camaro', 'Corvette', 'Blazer', 'Trailblazer', 'Bolt', 'Spark', 'Cruze', 'Colorado', 'Express'] },
  // BMW (15 models)
  { brand: 'BMW', models: ['3 Series', '5 Series', '7 Series', 'X1', 'X3', 'X5', 'X7', '2 Series', '4 Series', '6 Series', '8 Series', 'Z4', 'iX', 'i4', 'M3'] },
  // Mercedes-Benz (15 models)
  { brand: 'Mercedes-Benz', models: ['C-Class', 'E-Class', 'S-Class', 'A-Class', 'GLA', 'GLC', 'GLE', 'GLS', 'CLA', 'CLS', 'SL', 'AMG GT', 'EQC', 'EQS', 'Maybach'] },
  // Audi (14 models)
  { brand: 'Audi', models: ['A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'Q3', 'Q5', 'Q7', 'Q8', 'TT', 'R8', 'e-tron', 'RS6'] },
  // Hyundai (14 models)
  { brand: 'Hyundai', models: ['Elantra', 'Sonata', 'Accent', 'Veloster', 'Tucson', 'Santa Fe', 'Palisade', 'Venue', 'Kona', 'Nexo', 'Ioniq', 'Genesis', 'Azera', 'Equus'] },
  // Kia (13 models)
  { brand: 'Kia', models: ['Optima', 'Sorento', 'Sportage', 'Forte', 'Rio', 'Telluride', 'Seltos', 'Soul', 'Stinger', 'Cadenza', 'K900', 'Niro', 'EV6'] },
  // Mazda (12 models)
  { brand: 'Mazda', models: ['CX-5', 'CX-9', 'Mazda3', 'Mazda6', 'CX-3', 'CX-30', 'MX-5 Miata', 'CX-50', 'CX-90', 'RX-8', 'Tribute', 'B-Series'] },
  // Lexus (12 models)
  { brand: 'Lexus', models: ['RX', 'ES', 'NX', 'GX', 'LX', 'IS', 'GS', 'LS', 'RC', 'LC', 'UX', 'LFA'] },
  // Volkswagen (12 models)
  { brand: 'Volkswagen', models: ['Jetta', 'Passat', 'Golf', 'Tiguan', 'Atlas', 'Arteon', 'ID.4', 'Beetle', 'Touareg', 'CC', 'Eos', 'Routan'] },
  // Subaru (10 models)
  { brand: 'Subaru', models: ['Outback', 'Forester', 'Crosstrek', 'Ascent', 'Legacy', 'Impreza', 'WRX', 'BRZ', 'Tribeca', 'Baja'] },
  // Jeep (10 models)
  { brand: 'Jeep', models: ['Wrangler', 'Grand Cherokee', 'Cherokee', 'Compass', 'Renegade', 'Gladiator', 'Wagoneer', 'Grand Wagoneer', 'Commander', 'Liberty'] },
  // Dodge (10 models)
  { brand: 'Dodge', models: ['Charger', 'Challenger', 'Durango', 'Journey', 'Grand Caravan', 'Ram 1500', 'Viper', 'Dart', 'Avenger', 'Caliber'] },
  // GMC (9 models)
  { brand: 'GMC', models: ['Sierra', 'Yukon', 'Acadia', 'Terrain', 'Canyon', 'Savana', 'Envoy', 'Denali', 'Hummer EV'] },
  // Acura (9 models)
  { brand: 'Acura', models: ['MDX', 'RDX', 'TLX', 'ILX', 'RLX', 'NSX', 'ZDX', 'TSX', 'RL'] },
  // Infiniti (9 models)
  { brand: 'Infiniti', models: ['Q50', 'Q60', 'Q70', 'QX50', 'QX60', 'QX80', 'G37', 'FX', 'M'] },
  // Volvo (8 models)
  { brand: 'Volvo', models: ['XC90', 'XC60', 'XC40', 'S90', 'S60', 'V90', 'V60', 'C30'] },
  // Porsche (8 models)
  { brand: 'Porsche', models: ['911', 'Cayenne', 'Macan', 'Panamera', 'Boxster', 'Cayman', 'Taycan', 'Carrera'] },
  // Tesla (7 models)
  { brand: 'Tesla', models: ['Model S', 'Model 3', 'Model X', 'Model Y', 'Roadster', 'Cybertruck', 'Semi'] },
  // Land Rover (7 models)
  { brand: 'Land Rover', models: ['Range Rover', 'Range Rover Sport', 'Discovery', 'Defender', 'Evoque', 'Velar', 'LR4'] },
  // Jaguar (7 models)
  { brand: 'Jaguar', models: ['XF', 'XE', 'F-Pace', 'E-Pace', 'I-Pace', 'F-Type', 'XJ'] },
  // Mitsubishi (7 models)
  { brand: 'Mitsubishi', models: ['Outlander', 'Eclipse Cross', 'Mirage', 'Lancer', 'Pajero', 'Montero', 'Galant'] },
  // Chrysler (6 models)
  { brand: 'Chrysler', models: ['300', 'Pacifica', 'Voyager', 'Aspen', 'Sebring', 'PT Cruiser'] },
  // Buick (6 models)
  { brand: 'Buick', models: ['Enclave', 'Encore', 'LaCrosse', 'Regal', 'Verano', 'Riviera'] },
  // Cadillac (6 models)
  { brand: 'Cadillac', models: ['Escalade', 'XT5', 'XT4', 'CT5', 'CT4', 'XTS'] },
];

// Real-world VIN patterns (first 9 characters - WMI + VDS excluding check digit)
// Format: WMI (3) + VDS (6) = 9 characters
const vinPatterns = {
  'Toyota': ['JTM', 'JT1', 'JT2', 'JT3', 'JT4', 'JT5', 'JT6', 'JT7', 'JT8', 'JT9', '4T1', '4T3', '5TD', '5TE', '5TF'],
  'Honda': ['JHM', 'JHN', '19X', '19U', '19V', '2HG', '2HK', '5J6', '5J8', '5FN', '5FP'],
  'Nissan': ['JN1', 'JN6', 'JN8', '1N4', '1N6', '5N1', '5N3', '5N4', '5N5', '5N6', '5N7', '5N8'],
  'Ford': ['1FA', '1FD', '1FM', '1FT', '1ZV', '3FA', '3FD', '3FM', '3FT', '4F2', '5L1', '5LM'],
  'Chevrolet': ['1G1', '1G2', '1GC', '1GD', '1GK', '1GN', '2G1', '2G2', '2GC', '2GD', '2GK', '2GN', '3G1', '3G2'],
  'BMW': ['WBA', 'WBS', 'WBX', '5UX', '5UM', '5US', '5UY', 'WBA3', 'WBA5', 'WBA8'],
  'Mercedes-Benz': ['WDD', 'WDC', 'WDF', '4JG', 'WDB', 'WDC2', 'WDC3', 'WDC4', 'WDD2', 'WDD3'],
  'Audi': ['WAU', 'WUA', 'TRU', 'WA1', 'WAU2', 'WAU3', 'WAU4', 'WAU5', 'WAU6', 'WAU8'],
  'Hyundai': ['5NP', '5N1', 'KMH', 'KM8', 'KMH1', 'KMH2', 'KMH3', 'KMH4', 'KMH5', 'KMH6'],
  'Kia': ['KNA', 'KNJ', '5XX', '5XY', '5XZ', 'KNA1', 'KNA2', 'KNA3', 'KNA4', 'KNA5'],
  'Mazda': ['JM1', 'JM3', 'JM7', 'JMZ', '4F2', '4F4', 'JM1B', 'JM1G', 'JM1N', 'JM1Y'],
  'Lexus': ['JTH', 'JTJ', '4T1', '4T3', '5TD', '5TE', '5TF', 'JTHB', 'JTHC', 'JTHD'],
  'Volkswagen': ['WVW', '1VW', '3VW', 'WVW2', 'WVW3', 'WVW4', 'WVW5', 'WVW6', 'WVW7', 'WVW8'],
  'Subaru': ['JF1', 'JF2', '4S3', '4S4', 'JF1A', 'JF1B', 'JF1C', 'JF1D', 'JF1E', 'JF1F'],
  'Jeep': ['1C4', '1C6', '1J4', '1J8', '1J8A', '1J8B', '1J8C', '1J8D', '1J8E', '1J8F'],
  'Dodge': ['1B3', '1C3', '1D3', '2B3', '2C3', '2D3', '3B3', '3C3', '3D3', '4B3'],
  'GMC': ['1GT', '1GK', '1GN', '2GT', '2GK', '2GN', '3GT', '3GK', '3GN', '4GT'],
  'Acura': ['19U', '19V', '19X', 'JHM', 'JHN', '19UA', '19UB', '19UC', '19UD', '19UE'],
  'Infiniti': ['JN1', 'JN6', 'JN8', '1N4', '1N6', 'JN1A', 'JN1B', 'JN1C', 'JN1D', 'JN1E'],
  'Volvo': ['YV1', 'YV2', 'YV3', 'YV4', 'YV5', 'YV1A', 'YV1B', 'YV1C', 'YV1D', 'YV1E'],
  'Porsche': ['WP0', 'WP1', 'WPO', 'WP0A', 'WP0B', 'WP0C', 'WP0D', 'WP0E', 'WP0F', 'WP0G'],
  'Tesla': ['5YJ', '5YJ3', '5YJ4', '5YJ5', '5YJ6', '5YJ7', '5YJ8', '5YJ9', '5YJA', '5YJB'],
  'Land Rover': ['SAL', 'SAD', 'SAL2', 'SAL3', 'SAL4', 'SAL5', 'SAL6', 'SAL7', 'SAL8', 'SAL9'],
  'Jaguar': ['SAJ', 'SAJ2', 'SAJ3', 'SAJ4', 'SAJ5', 'SAJ6', 'SAJ7', 'SAJ8', 'SAJ9', 'SAJA'],
  'Mitsubishi': ['JA3', 'JA4', 'JA7', 'JA8', 'JA3A', 'JA3B', 'JA3C', 'JA3D', 'JA3E', 'JA3F'],
  'Chrysler': ['1C3', '2C3', '3C3', '4C3', '1C3A', '1C3B', '1C3C', '1C3D', '1C3E', '1C3F'],
  'Buick': ['2G4', '2G5', '4G4', '4G5', '2G4A', '2G4B', '2G4C', '2G4D', '2G4E', '2G4F'],
  'Cadillac': ['1G6', '2G6', '3G6', '4G6', '1G6A', '1G6B', '1G6C', '1G6D', '1G6E', '1G6F'],
};

// Generate VIN pattern (9 characters) for a brand
const generateVinPattern = (brandName) => {
  const patterns = vinPatterns[brandName] || ['1HG', '1HT', '1HV', '1HW', '1HX'];
  const basePattern = randomItem(patterns);
  // Add 6 more characters to make 9 total (VDS portion)
  const vdsChars = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789';
  let vds = '';
  for (let i = 0; i < 6; i++) {
    vds += randomItem(vdsChars.split(''));
  }
  return basePattern + vds;
};

// Real-world engine types
const engineTypes = [
  '1.5L I4 Turbo Petrol', '1.6L I4 Petrol', '1.8L I4 Petrol', '2.0L I4 Petrol', '2.0L I4 Turbo Petrol',
  '2.4L I4 Petrol', '2.5L I4 Petrol', '2.5L I4 Hybrid', '3.0L V6 Petrol', '3.5L V6 Petrol',
  '3.6L V6 Petrol', '4.0L V6 Petrol', '4.6L V8 Petrol', '5.0L V8 Petrol', '5.7L V8 Petrol',
  '6.2L V8 Petrol', '1.6L I4 Diesel', '2.0L I4 Diesel', '2.2L I4 Diesel', '2.5L I4 Diesel',
  '3.0L V6 Diesel', '3.5L V6 Diesel', '1.5L I4 Hybrid', '2.0L I4 Hybrid', '2.5L I4 Hybrid',
  '3.5L V6 Hybrid', 'Electric Motor', 'Dual Motor Electric', 'Tri Motor Electric'
];

// Real-world transmission types (matching Transmission model enum)
const transmissionTypes = ['Automatic', 'Manual', 'CVT', 'Hybrid', 'EV'];

// Real-world trim levels
const trimLevels = [
  ['Base', 'LE', 'XLE', 'Limited'],
  ['L', 'LX', 'EX', 'Touring'],
  ['S', 'SE', 'SEL', 'Limited'],
  ['Sport', 'Premium', 'Luxury', 'Platinum'],
  ['Standard', 'Comfort', 'Premium', 'Ultimate'],
  ['Core', 'Plus', 'Pro', 'Max'],
];

// Real-world parts data
const partsData = [
  // Engine Parts
  { name: 'Spark Plug', category: 'Engine Parts', subCategory: 'Spark Plugs', prefix: 'SP', priceRange: [8, 45] },
  { name: 'Ignition Coil', category: 'Engine Parts', subCategory: 'Ignition System', prefix: 'IC', priceRange: [35, 180] },
  { name: 'Timing Belt', category: 'Engine Parts', subCategory: 'Timing Components', prefix: 'TB', priceRange: [45, 350] },
  { name: 'Timing Chain', category: 'Engine Parts', subCategory: 'Timing Components', prefix: 'TC', priceRange: [120, 800] },
  { name: 'Water Pump', category: 'Engine Parts', subCategory: 'Cooling System', prefix: 'WP', priceRange: [65, 450] },
  { name: 'Thermostat', category: 'Engine Parts', subCategory: 'Cooling System', prefix: 'TH', priceRange: [15, 85] },
  { name: 'Radiator', category: 'Engine Parts', subCategory: 'Cooling System', prefix: 'RD', priceRange: [150, 1200] },
  { name: 'Radiator Hose', category: 'Engine Parts', subCategory: 'Cooling System', prefix: 'RH', priceRange: [12, 95] },
  { name: 'Oil Filter', category: 'Engine Parts', subCategory: 'Oil Filters', prefix: 'OF', priceRange: [5, 35] },
  { name: 'Air Filter', category: 'Engine Parts', subCategory: 'Air Filters', prefix: 'AF', priceRange: [8, 55] },
  { name: 'Fuel Filter', category: 'Engine Parts', subCategory: 'Fuel System', prefix: 'FF', priceRange: [12, 85] },
  { name: 'Fuel Pump', category: 'Engine Parts', subCategory: 'Fuel System', prefix: 'FP', priceRange: [85, 650] },
  { name: 'Alternator', category: 'Engine Parts', subCategory: 'Electrical', prefix: 'ALT', priceRange: [150, 850] },
  { name: 'Starter Motor', category: 'Engine Parts', subCategory: 'Electrical', prefix: 'SM', priceRange: [120, 750] },
  { name: 'Battery', category: 'Engine Parts', subCategory: 'Batteries', prefix: 'BAT', priceRange: [80, 350] },
  
  // Brake System
  { name: 'Brake Pad Set', category: 'Brake System', subCategory: 'Brake Pads', prefix: 'BP', priceRange: [25, 280] },
  { name: 'Brake Rotor', category: 'Brake System', subCategory: 'Brake Rotors', prefix: 'BR', priceRange: [45, 450] },
  { name: 'Brake Caliper', category: 'Brake System', subCategory: 'Brake Calipers', prefix: 'BC', priceRange: [85, 850] },
  { name: 'Brake Master Cylinder', category: 'Brake System', subCategory: 'Brake Components', prefix: 'BMC', priceRange: [95, 650] },
  { name: 'Brake Line', category: 'Brake System', subCategory: 'Brake Components', prefix: 'BL', priceRange: [15, 125] },
  { name: 'Brake Fluid', category: 'Brake System', subCategory: 'Brake Fluids', prefix: 'BF', priceRange: [8, 45] },
  
  // Suspension
  { name: 'Shock Absorber', category: 'Suspension', subCategory: 'Shock Absorbers', prefix: 'SH', priceRange: [45, 450] },
  { name: 'Strut Assembly', category: 'Suspension', subCategory: 'Struts', prefix: 'ST', priceRange: [120, 950] },
  { name: 'Coil Spring', category: 'Suspension', subCategory: 'Springs', prefix: 'CS', priceRange: [35, 280] },
  { name: 'Control Arm', category: 'Suspension', subCategory: 'Control Arms', prefix: 'CA', priceRange: [65, 550] },
  { name: 'Ball Joint', category: 'Suspension', subCategory: 'Ball Joints', prefix: 'BJ', priceRange: [25, 180] },
  { name: 'Tie Rod End', category: 'Suspension', subCategory: 'Tie Rods', prefix: 'TR', priceRange: [18, 150] },
  { name: 'Wheel Bearing', category: 'Suspension', subCategory: 'Wheel Bearings', prefix: 'WB', priceRange: [35, 350] },
  { name: 'Sway Bar Link', category: 'Suspension', subCategory: 'Sway Bars', prefix: 'SBL', priceRange: [15, 95] },
  
  // Body Parts
  { name: 'Headlight Assembly', category: 'Body Parts', subCategory: 'Headlights', prefix: 'HL', priceRange: [120, 1800] },
  { name: 'Taillight Assembly', category: 'Body Parts', subCategory: 'Taillights', prefix: 'TL', priceRange: [85, 1200] },
  { name: 'Front Bumper', category: 'Body Parts', subCategory: 'Bumpers', prefix: 'FB', priceRange: [250, 2500] },
  { name: 'Rear Bumper', category: 'Body Parts', subCategory: 'Bumpers', prefix: 'RB', priceRange: [250, 2500] },
  { name: 'Hood', category: 'Body Parts', subCategory: 'Body Panels', prefix: 'HD', priceRange: [350, 3500] },
  { name: 'Fender', category: 'Body Parts', subCategory: 'Body Panels', prefix: 'FN', priceRange: [180, 1800] },
  { name: 'Door Panel', category: 'Body Parts', subCategory: 'Body Panels', prefix: 'DP', priceRange: [250, 2500] },
  { name: 'Windshield', category: 'Body Parts', subCategory: 'Glass', prefix: 'WS', priceRange: [200, 1200] },
  { name: 'Side Mirror', category: 'Body Parts', subCategory: 'Mirrors', prefix: 'SM', priceRange: [45, 650] },
  { name: 'Windshield Wiper', category: 'Body Parts', subCategory: 'Wipers', prefix: 'WW', priceRange: [8, 45] },
  
  // Exhaust System
  { name: 'Exhaust Muffler', category: 'Exhaust System', subCategory: 'Mufflers', prefix: 'EM', priceRange: [85, 850] },
  { name: 'Catalytic Converter', category: 'Exhaust System', subCategory: 'Catalytic Converters', prefix: 'CC', priceRange: [150, 2500] },
  { name: 'Exhaust Pipe', category: 'Exhaust System', subCategory: 'Exhaust Pipes', prefix: 'EP', priceRange: [45, 450] },
  { name: 'O2 Sensor', category: 'Exhaust System', subCategory: 'Sensors', prefix: 'O2', priceRange: [35, 280] },
  
  // Electrical
  { name: 'Headlight Bulb', category: 'Electrical', subCategory: 'Bulbs', prefix: 'HB', priceRange: [8, 95] },
  { name: 'Fog Light', category: 'Electrical', subCategory: 'Lights', prefix: 'FL', priceRange: [25, 280] },
  { name: 'Fuse Box', category: 'Electrical', subCategory: 'Fuses', prefix: 'FBX', priceRange: [35, 250] },
  { name: 'Relay', category: 'Electrical', subCategory: 'Relays', prefix: 'RL', priceRange: [5, 45] },
  { name: 'Wiring Harness', category: 'Electrical', subCategory: 'Wiring', prefix: 'WH', priceRange: [85, 850] },
  
  // Transmission
  { name: 'Transmission Fluid', category: 'Transmission', subCategory: 'Fluids', prefix: 'TF', priceRange: [12, 85] },
  { name: 'Transmission Filter', category: 'Transmission', subCategory: 'Filters', prefix: 'TFL', priceRange: [25, 180] },
  { name: 'Clutch Kit', category: 'Transmission', subCategory: 'Clutch', prefix: 'CK', priceRange: [150, 1200] },
  { name: 'CV Joint', category: 'Transmission', subCategory: 'CV Joints', prefix: 'CVJ', priceRange: [45, 450] },
  { name: 'Drive Shaft', category: 'Transmission', subCategory: 'Drive Shafts', prefix: 'DS', priceRange: [250, 2500] },
];

const seedData = async () => {
  console.log('🌱 Seeding database with real-world data...\n');

  try {
    // 1. Seed Brands
    console.log('📦 Seeding Brands...');
    const brandNames = realWorldCarData.map(d => d.brand);
    const brands = await Brand.insertMany(
      brandNames.map(name => ({
        brandName: name,
        brandImage: `https://via.placeholder.com/200x200/0066CC/FFFFFF?text=${encodeURIComponent(name)}`,
        visibility: true
      }))
    );
    console.log(`   ✓ Created ${brands.length} brands\n`);

    // 2. Seed Categories
    console.log('📦 Seeding Categories...');
    const categoryNames = [...new Set(partsData.map(p => p.category))];
    const categories = await Category.insertMany(
      categoryNames.map(name => ({
        categoryName: name,
        categoryImage: `https://via.placeholder.com/200x200/009900/FFFFFF?text=${encodeURIComponent(name)}`,
        visibility: true
      }))
    );
    const categoryMap = {};
    categories.forEach(cat => { categoryMap[cat.categoryName] = cat._id; });
    console.log(`   ✓ Created ${categories.length} categories\n`);

    // 3. Seed SubCategories
    console.log('📦 Seeding SubCategories...');
    const subCategoryMap = {};
    const subCategoryData = [];
    partsData.forEach(part => {
      if (part.subCategory && !subCategoryMap[part.subCategory]) {
        subCategoryMap[part.subCategory] = {
          name: part.subCategory,
          category: categoryMap[part.category]
        };
        subCategoryData.push({
          subCategoryName: part.subCategory,
          category: categoryMap[part.category],
          visibility: true
        });
      }
    });
    const subCategories = await SubCategory.insertMany(subCategoryData);
    const subCategoryIdMap = {};
    subCategories.forEach(sub => { subCategoryIdMap[sub.subCategoryName] = sub._id; });
    console.log(`   ✓ Created ${subCategories.length} subcategories\n`);

    // 4. Seed Models (200+ models)
    console.log('📦 Seeding Models (200+ models)...');
    const modelDocuments = [];
    realWorldCarData.forEach((brandData, brandIndex) => {
      const brand = brands.find(b => b.brandName === brandData.brand);
      if (brand) {
        brandData.models.forEach(modelName => {
          modelDocuments.push({
            modelName,
            brand: brand._id,
            visibility: true
          });
        });
      }
    });
    const models = await Model.insertMany(modelDocuments);
    console.log(`   ✓ Created ${models.length} models\n`);

    // 5. Seed Years (2000-2024)
    console.log('📦 Seeding Years...');
    const years = await Year.insertMany(
      Array.from({ length: 25 }, (_, i) => ({
        year: String(2024 - i),
        visibility: true
      }))
    );
    console.log(`   ✓ Created ${years.length} years\n`);

    // 6. Seed Fuel Types
    console.log('📦 Seeding Fuel Types...');
    const fuels = await Fuel.insertMany([
      { type: 'Petrol', visibility: true },
      { type: 'Diesel', visibility: true },
      { type: 'Hybrid', visibility: true },
      { type: 'Electric', visibility: true },
    ]);
    console.log(`   ✓ Created ${fuels.length} fuel types\n`);

    // 7. Seed Engines
    console.log('📦 Seeding Engines...');
    const engineDocuments = [];
    const usedCodes = new Set();
    engineTypes.forEach((et, idx) => {
      const match = et.match(/(\d+\.\d+)L\s*(.+)/);
      if (match) {
        const [, displacement, rest] = match;
        const isDiesel = rest.includes('Diesel');
        const isHybrid = rest.includes('Hybrid');
        const isElectric = rest.includes('Electric');
        const fuelType = isElectric ? 'Electric' : isHybrid ? 'Hybrid' : isDiesel ? 'Diesel' : 'Petrol';
        const cylMatch = rest.match(/I(\d+)|V(\d+)/);
        const cylinders = cylMatch ? (cylMatch[1] ? parseInt(cylMatch[1]) : parseInt(cylMatch[2])) : 4;
        
        // Create unique code
        let baseCode = et.replace(/\s+/g, '');
        let code = baseCode.substring(0, 8);
        let counter = 0;
        while (usedCodes.has(code)) {
          counter++;
          code = (baseCode.substring(0, 7) + counter).substring(0, 8);
        }
        usedCodes.add(code);
        
        engineDocuments.push({
          code,
          displacement: displacement + 'L',
          fuelType,
          cylinders,
          isActive: true
        });
      }
    });
    const createdEngines = await Engine.insertMany(engineDocuments);
    console.log(`   ✓ Created ${createdEngines.length} engines\n`);

    // 8. Seed Transmissions
    console.log('📦 Seeding Transmissions...');
    const transmissionDocuments = [];
    const usedOemCodes = new Set();
    transmissionTypes.forEach((type, idx) => {
      const mechanisms = {
        'Automatic': ['TorqueConverter', 'DCT'],
        'Manual': null,
        'CVT': ['eCVT'],
        'Hybrid': ['eCVT'],
        'EV': null
      };
      const mechanism = mechanisms[type] ? randomItem(mechanisms[type]) : null;
      const gearCounts = {
        'Automatic': [6, 8, 9, 10],
        'Manual': [5, 6],
        'CVT': null,
        'Hybrid': null,
        'EV': null
      };
      const gearCount = gearCounts[type] ? randomItem(gearCounts[type]) : null;
      const layouts = ['FWD', 'RWD', 'AWD'];
      
      // Generate unique OEM code
      let oemCode = `${type.substring(0, 2).toUpperCase()}${idx}${randomInt(0, 9)}`;
      let counter = 0;
      while (usedOemCodes.has(oemCode)) {
        counter++;
        oemCode = `${type.substring(0, 2).toUpperCase()}${idx}${counter}${randomInt(0, 9)}`;
      }
      usedOemCodes.add(oemCode);
      
      transmissionDocuments.push({
        type,
        mechanism,
        gearCount,
        layout: randomItem(layouts),
        oemCode,
        isActive: true
      });
    });
    const createdTransmissions = await Transmission.insertMany(transmissionDocuments);
    console.log(`   ✓ Created ${createdTransmissions.length} transmissions\n`);

    // 9. Seed Vehicle Configurations (all variants for 200+ models)
    console.log('📦 Seeding Vehicle Configurations (all variants)...');
    const vehicleConfigs = [];
    const usedConfigKeys = new Set();
    
    let configCount = 0;
    models.forEach(model => {
      const brand = brands.find(b => b._id.toString() === model.brand.toString());
      if (!brand) return;
      
      // Generate variants for each model (2-5 variants per model)
      const variantCount = randomInt(2, 5);
      const modelYears = [2020, 2021, 2022, 2023, 2024];
      
      let attempts = 0;
      let created = 0;
      while (created < variantCount && attempts < 50) {
        attempts++;
        const year = randomItem(modelYears);
        const engineType = randomItem(engineTypes);
        const transmission = randomItem(transmissionTypes);
        
        // Create unique key for this combination
        const configKey = `${brand._id.toString()}_${model._id.toString()}_${year}_${engineType}_${transmission}`;
        
        // Skip if this combination already exists
        if (usedConfigKeys.has(configKey)) {
          continue;
        }
        
        usedConfigKeys.add(configKey);
        const trim = randomItem(trimLevels);
        const frameCode = `${brand.brandName.substring(0, 2).toUpperCase()}${randomInt(10, 99)}`;
        const vinPattern = generateVinPattern(brand.brandName);
        
        vehicleConfigs.push({
          brand: brand._id,
          model: model._id,
          year,
          engineType,
          transmission,
          frameCode,
          region: 'GCC',
          trim,
          commonName: `${brand.brandName} ${model.modelName} ${year} ${trim[0]}`,
          vinPatterns: [vinPattern],
          description: `${brand.brandName} ${model.modelName} ${year} ${trim[0]} trim with ${engineType} engine and ${transmission} transmission`,
          visibility: true,
          isActive: true
        });
        configCount++;
        created++;
      }
    });
    
    const createdVehicleConfigs = await VehicleConfiguration.insertMany(vehicleConfigs);
    console.log(`   ✓ Created ${createdVehicleConfigs.length} vehicle configurations\n`);

    // 10. Seed VIN Data
    console.log('📦 Seeding VIN Data...');
    const vinDataEntries = [];
    createdVehicleConfigs.forEach((config, idx) => {
      if (idx % 2 === 0) { // Create VIN data for every other config to save space
        const brand = brands.find(b => b._id.toString() === config.brand.toString());
        const model = models.find(m => m._id.toString() === config.model.toString());
        if (brand && model && config.vinPatterns && config.vinPatterns.length > 0) {
          vinDataEntries.push({
            vinKey: config.vinPatterns[0],
            data: {
              brand: brand.brandName,
              model: model.modelName,
              year: String(config.year),
              country: 'UAE'
            }
          });
        }
      }
    });
    await VinData.insertMany(vinDataEntries);
    console.log(`   ✓ Created ${vinDataEntries.length} VIN data entries\n`);

    // 11. Seed Users
    console.log('📦 Seeding Users...');
    const hashedPassword = await bcrypt.hash('password123', 10);
    const userData = [
      { name: 'Super Admin', email: 'admin@premart.com', phone: '+971509999999', role: 'SUPER_ADMIN', verify: true },
      ...Array.from({ length: 50 }, (_, i) => ({
        name: `Customer ${i + 1}`,
        email: `customer${i + 1}@example.com`,
        phone: `+971501234${String(i).padStart(3, '0')}`,
        role: 'CUSTOMER',
        verify: Math.random() > 0.2
      }))
    ];
    const users = await User.insertMany(
      userData.map(u => ({
        name: u.name,
        email: u.email,
        phone: u.phone,
        password: hashedPassword,
        accountVisibility: true,
        accountVerify: u.verify,
        role: u.role
      }))
    );
    console.log(`   ✓ Created ${users.length} users (password: password123)\n`);

    // 12. Seed Shops (50 shops with detailed owner info)
    console.log('📦 Seeding Shops (50 shops with detailed owner information)...');
    const shopPassword = await bcrypt.hash('shop123', 10);
    const shopNames = [
      'Auto Parts Express', 'Premium Auto Supplies', 'Quick Parts Center', 'Elite Auto Components',
      'Speed Parts Hub', 'AutoZone Dubai', 'Car Parts Warehouse', 'Pro Auto Spares', 'Gulf Auto Parts',
      'Desert Auto Components', 'Royal Auto Parts', 'Emirates Auto Supply', 'Dubai Car Parts', 'Sharjah Auto Mart',
      'Abu Dhabi Parts Center', 'Fujairah Auto Store', 'Ras Al Khaimah Parts', 'Ajman Auto Hub', 'Umm Al Quwain Parts',
      'Al Ain Auto Supply', 'Jebel Ali Parts', 'Deira Auto Center', 'Bur Dubai Parts', 'Marina Auto Store',
      'Downtown Auto Parts', 'Business Bay Parts', 'JBR Auto Supply', 'Palm Jumeirah Parts', 'Dubai Marina Auto',
      'Motor City Parts', 'Dubai Sports City Auto', 'Dubai Investment Park Parts', 'Dubai Silicon Oasis Auto',
      'Dubai Production City Parts', 'Dubai Media City Auto', 'Dubai Knowledge Park Parts', 'Dubai Healthcare City Auto',
      'Dubai International City Parts', 'Dubai Festival City Auto', 'Dubai Festival Plaza Parts', 'Dubai Mall Auto',
      'Mall of Emirates Parts', 'Dubai Outlet Mall Auto', 'Dubai Marina Mall Parts', 'Ibn Battuta Mall Auto',
      'Dubai Festival City Mall Parts', 'City Centre Deira Auto', 'City Centre Mirdif Parts', 'City Centre Meaisem Auto',
      'Arabian Centre Parts', 'Dubai Hills Mall Auto'
    ];
    
    const shopLocations = ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Fujairah', 'Umm Al Quwain', 'Al Ain'];
    const areas = [
      'Sheikh Zayed Road', 'Business Bay', 'Deira', 'Downtown', 'JBR', 'Dubai Marina', 'Palm Jumeirah',
      'Motor City', 'Sports City', 'Investment Park', 'Silicon Oasis', 'Production City', 'Media City',
      'Knowledge Park', 'Healthcare City', 'International City', 'Festival City', 'Al Barsha', 'Al Quoz',
      'Jebel Ali', 'Bur Dubai', 'Karama', 'Satwa', 'Al Wasl', 'Jumeirah', 'Umm Suqeim'
    ];
    
    const firstNames = ['Ahmed', 'Mohammed', 'Ali', 'Omar', 'Hassan', 'Khalid', 'Saeed', 'Youssef', 'Ibrahim', 'Mahmoud', 'Tariq', 'Faisal', 'Salem', 'Rashid', 'Hamdan'];
    const lastNames = ['Al Maktoum', 'Al Nahyan', 'Al Qasimi', 'Al Nuaimi', 'Al Sharqi', 'Al Mualla', 'Hassan', 'Ibrahim', 'Khalil', 'Mahmoud', 'Omar', 'Salem', 'Tariq', 'Youssef', 'Zayed'];
    
    const shops = await Shop.insertMany(
      shopNames.map((name, i) => {
        const ownerFirstName = randomItem(firstNames);
        const ownerLastName = randomItem(lastNames);
        const location = randomItem(shopLocations);
        const area = randomItem(areas);
        const shopNumber = String(i + 1).padStart(3, '0');
        
        return {
          shopeDetails: {
            shopName: name,
            shopAddress: `${area}, ${location}, UAE`,
            shopMail: `${name.toLowerCase().replace(/\s+/g, '')}@premart.ae`,
            shopContact: `+971${randomInt(2, 7)}${String(i).padStart(7, '0')}`,
            shopLicenseNumber: `TRADE-LIC-${shopNumber}`,
            shopLicenseExpiry: '2025-12-31',
            EmiratesId: `784-${String(i + 1).padStart(4, '0')}-${String(i + 1).padStart(7, '0')}-${i + 1}`,
            shopLocation: location,
            taxRegistrationNumber: `TRN-${shopNumber}`,
            supportMail: `support@${name.toLowerCase().replace(/\s+/g, '')}.ae`,
            supportNumber: `+971${randomInt(2, 7)}${String(i + 1).padStart(7, '1')}`,
            password: shopPassword,
            shopBankDetails: {
              bankName: randomItem(['Emirates NBD', 'ADCB', 'FAB', 'Dubai Islamic Bank', 'Mashreq Bank', 'RAKBANK']),
              accountNumber: `${randomInt(100000, 999999)}${String(i).padStart(6, '0')}`,
              ibanNuber: `AE${randomInt(10, 99)}${String(i).padStart(20, '0')}`,
              branch: `${location} Main Branch`,
              swiftCode: `${randomItem(['EBIL', 'ADCBAE', 'FABAE', 'DUIBAE', 'BOMLAE', 'NRAKAE'])}XXX`
            }
          }
        };
      })
    );
    console.log(`   ✓ Created ${shops.length} shops with detailed owner information (password: shop123)\n`);

    // 13. Seed Parts Catalog (2000+ parts)
    console.log('📦 Seeding Parts Catalog (2000+ parts)...');
    const partsCatalog = [];
    let partCounter = 1;
    
    // Create multiple parts for each part type
    partsData.forEach(partType => {
      const partCount = randomInt(15, 35); // 15-35 parts per type
      for (let i = 0; i < partCount; i++) {
        const partNumber = `${partType.prefix}-${String(partCounter).padStart(5, '0')}`;
        const compatibleCount = randomInt(5, 25);
        const compatibleVehicleConfigs = [];
        for (let j = 0; j < compatibleCount; j++) {
          compatibleVehicleConfigs.push(randomItem(createdVehicleConfigs)._id);
        }
        
        const basePrice = randomInt(...partType.priceRange);
        const madeIn = randomItem(['Japan', 'Germany', 'USA', 'UAE', 'China', 'Korea', 'Thailand', 'India', 'Mexico', 'Canada']);
        const warranty = randomItem(['6 Months', '1 Year', '2 Years', '3 Years', '5 Years']);
        
        const partData = {
          partNumber,
          partName: `${partType.name} - ${partType.prefix}${String(partCounter).padStart(3, '0')}`,
          description: `High-quality ${partType.name.toLowerCase()} compatible with multiple vehicle models. Made in ${madeIn}. ${warranty} warranty included.`,
          category: categoryMap[partType.category],
          compatibleVehicleConfigs: [...new Set(compatibleVehicleConfigs)],
          madeIn,
          weight: Math.round((randomFloat(0.1, 25) + 0.1) * 100) / 100,
          dimensions: {
            length: randomInt(5, 150),
            width: randomInt(5, 80),
            height: randomInt(2, 50)
          },
          oemNumber: `OEM-${partType.prefix}-${String(partCounter).padStart(6, '0')}`,
          warranty,
          images: [
            `https://via.placeholder.com/400x400/0066CC/FFFFFF?text=${encodeURIComponent(partType.name)}`,
            `https://via.placeholder.com/400x400/009900/FFFFFF?text=${encodeURIComponent(partType.name)}+2`
          ],
          isActive: true
        };
        
        if (partType.subCategory && subCategoryIdMap[partType.subCategory]) {
          partData.subCategory = subCategoryIdMap[partType.subCategory];
        }
        
        partsCatalog.push(partData);
        partCounter++;
      }
    });
    
    const createdPartsCatalog = await PartsCatalog.insertMany(partsCatalog);
    console.log(`   ✓ Created ${createdPartsCatalog.length} parts in catalog\n`);

    // 14. Seed Shop Products (each shop has 60-80% of parts)
    console.log('📦 Seeding Shop Products...');
    const shopProducts = [];
    shops.forEach(shop => {
      const partsToAdd = randomInt(Math.floor(createdPartsCatalog.length * 0.6), Math.floor(createdPartsCatalog.length * 0.8));
      const selectedParts = [];
      const usedIndices = new Set();
      while (selectedParts.length < partsToAdd) {
        const idx = randomInt(0, createdPartsCatalog.length - 1);
        if (!usedIndices.has(idx)) {
          usedIndices.add(idx);
          selectedParts.push(createdPartsCatalog[idx]);
        }
      }
      
      selectedParts.forEach(part => {
        const basePrice = randomInt(50, 2000);
        const hasDiscount = Math.random() > 0.5;
        const discountPercent = hasDiscount ? randomInt(5, 30) : 0;
        const discount = hasDiscount ? Math.floor(basePrice * discountPercent / 100) : 0;
        
        shopProducts.push({
          shopId: shop._id,
          part: part._id,
          price: basePrice,
          discountedPrice: hasDiscount ? basePrice - discount : null,
          stock: randomInt(0, 500),
          isAvailable: Math.random() > 0.15 // 85% available
        });
      });
    });
    
    await ShopProduct.insertMany(shopProducts);
    console.log(`   ✓ Created ${shopProducts.length} shop products\n`);

    // 15. Seed Delivery Agencies
    console.log('📦 Seeding Delivery Agencies...');
    const agencyPassword = await bcrypt.hash('agency123', 10);
    const agencyNames = [
      'Fast Delivery Services', 'Express Logistics', 'Quick Ship UAE', 'Gulf Delivery Solutions',
      'Premium Logistics', 'Emirates Express', 'Dubai Delivery', 'Sharjah Logistics', 'Abu Dhabi Express',
      'Gulf Coast Delivery', 'Arabian Logistics', 'Desert Express', 'City Delivery Services', 'Metro Logistics',
      'Coastal Delivery', 'Royal Express', 'Elite Logistics', 'Prime Delivery', 'Swift Logistics', 'Rapid Delivery'
    ];
    const agencies = await DeliveryAgency.insertMany(
      agencyNames.map((name, i) => ({
        agencyDetails: {
          email: `agency${agency + 1}@delivery.ae`,
          password: agencyPassword,
          profileImage: `https://via.placeholder.com/200x200/FF6600/FFFFFF?text=Agency+${i + 1}`,
          agencyName: name,
          agencyAddress: `${randomItem(areas)}, ${randomItem(shopLocations)}, UAE`,
          agencyMail: `agency${i + 1}@delivery.ae`,
          agencyContact: `+971${randomInt(2, 7)}${String(i + 1).padStart(7, '2')}`,
          agencyLicenseNumber: `DL-${String(i + 1).padStart(4, '0')}`,
          agencyLicenseExpiry: '2025-12-31',
          emiratesId: `784-${String(i + 1).padStart(4, '2')}-${String(i + 1).padStart(7, '2')}-${i + 1}`,
          agencyLocation: randomItem(shopLocations),
          supportMail: `support@${name.toLowerCase().replace(/\s+/g, '')}.ae`,
          supportNumber: `+971${randomInt(2, 7)}${String(i + 1).padStart(7, '3')}`,
          payoutType: randomItem(['weekly', 'monthly'])
        }
      }))
    );
    console.log(`   ✓ Created ${agencies.length} delivery agencies (password: agency123)\n`);

    // 16. Seed Delivery Boys
    console.log('📦 Seeding Delivery Boys...');
    const deliveryBoys = await DeliveryBoy.insertMany(
      Array.from({ length: 100 }, (_, i) => {
        // Ensure unique phone number by using index
        const areaCode = 50 + (i % 10); // Cycle through 50-59
        const uniqueNumber = String(1000000 + i).substring(1); // Ensures 7-digit unique number
        return {
          name: `Delivery Boy ${i + 1}`,
          phone: `+971${areaCode}${uniqueNumber}`,
          email: `boy${i + 1}@delivery.ae`,
          agencyId: randomItem(agencies)._id,
          isOnline: Math.random() > 0.4,
          availability: Math.random() > 0.3,
          latitude: 25.0 + Math.random() * 0.8,
          longitude: 55.0 + Math.random() * 0.8,
          areaAssigned: randomItem(areas),
          city: randomItem(shopLocations),
          accountVerify: Math.random() > 0.2,
          countryCode: '+971'
        };
      })
    );
    console.log(`   ✓ Created ${deliveryBoys.length} delivery boys\n`);

    // 17. Seed Banners
    console.log('📦 Seeding Banners...');
    const banners = await Banner.insertMany(
      Array.from({ length: 10 }, (_, i) => ({
        title: `Special Offer ${i + 1}`,
        pic: `https://via.placeholder.com/1200x400/FF6600/FFFFFF?text=Special+Offer+${i + 1}`,
        isActive: true,
        redirectScreen: '/products',
        shopId: randomItem(shops)._id
      }))
    );
    console.log(`   ✓ Created ${banners.length} banners\n`);

    // 18. Seed Coupons
    console.log('📦 Seeding Coupons...');
    const coupons = await Coupon.insertMany(
      Array.from({ length: 30 }, (_, i) => ({
        code: `PREMART${String(i + 1).padStart(3, '0')}`,
        discountValue: randomInt(10, 40),
        discountType: 'percent',
        minOrderAmount: randomInt(100, 1000),
        usageLimit: randomInt(50, 1000),
        startDate: new Date(),
        expiryDate: new Date(Date.now() + randomInt(30, 180) * 24 * 60 * 60 * 1000),
        isActive: Math.random() > 0.2,
        shopId: i % 4 === 0 ? null : randomItem(shops)._id
      }))
    );
    console.log(`   ✓ Created ${coupons.length} coupons\n`);

    console.log('\n✅ Database seeding completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`   • Brands: ${brands.length}`);
    console.log(`   • Categories: ${categories.length}`);
    console.log(`   • SubCategories: ${subCategories.length}`);
    console.log(`   • Models: ${models.length}`);
    console.log(`   • Years: ${years.length}`);
    console.log(`   • Fuel Types: ${fuels.length}`);
    console.log(`   • Engines: ${createdEngines.length}`);
    console.log(`   • Transmissions: ${createdTransmissions.length}`);
    console.log(`   • Vehicle Configurations: ${createdVehicleConfigs.length}`);
    console.log(`   • VIN Data Entries: ${vinDataEntries.length}`);
    console.log(`   • Users: ${users.length} (password: password123)`);
    console.log(`     - Admin: admin@premart.com (SUPER_ADMIN)`);
    console.log(`   • Shops: ${shops.length} (password: shop123)`);
    console.log(`   • Parts Catalog: ${createdPartsCatalog.length}`);
    console.log(`   • Shop Products: ${shopProducts.length}`);
    console.log(`   • Delivery Agencies: ${agencies.length} (password: agency123)`);
    console.log(`   • Delivery Boys: ${deliveryBoys.length}`);
    console.log(`   • Banners: ${banners.length}`);
    console.log(`   • Coupons: ${coupons.length}`);
    console.log('\n💾 Estimated database size: ~10-15MB\n');

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  }
};

const main = async () => {
  try {
    await connectDB();
    await clearDatabase();
    await seedData();
    await mongoose.connection.close();
    console.log('✅ Seed script completed. Database connection closed.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed script failed:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

main();
