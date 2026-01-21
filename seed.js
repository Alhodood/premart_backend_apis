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
    'engines', 'transmissions', 'groups', 'parts', 'reviews'
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

// Helper function to get random item from array
const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const seedData = async () => {
  console.log('🌱 Seeding database...\n');

  try {
    // 1. Seed Brands (12 brands)
    console.log('📦 Seeding Brands...');
    const brandNames = [
      'Toyota', 'Nissan', 'Honda', 'BMW', 'Mercedes-Benz', 'Audi',
      'Ford', 'Chevrolet', 'Lexus', 'Hyundai', 'Kia', 'Mazda'
    ];
    const brands = await Brand.insertMany(
      brandNames.map(name => ({
        brandName: name,
        brandImage: `https://via.placeholder.com/200?text=${name}`,
        visibility: true
      }))
    );
    console.log(`   ✓ Created ${brands.length} brands\n`);

    // 2. Seed Categories (8 categories)
    console.log('📦 Seeding Categories...');
    const categories = await Category.insertMany([
      { categoryName: 'Engine Parts', categoryImage: 'https://via.placeholder.com/200?text=Engine', visibility: true },
      { categoryName: 'Brake System', categoryImage: 'https://via.placeholder.com/200?text=Brake', visibility: true },
      { categoryName: 'Suspension', categoryImage: 'https://via.placeholder.com/200?text=Suspension', visibility: true },
      { categoryName: 'Electrical', categoryImage: 'https://via.placeholder.com/200?text=Electrical', visibility: true },
      { categoryName: 'Body Parts', categoryImage: 'https://via.placeholder.com/200?text=Body', visibility: true },
      { categoryName: 'Filters', categoryImage: 'https://via.placeholder.com/200?text=Filters', visibility: true },
      { categoryName: 'Exhaust System', categoryImage: 'https://via.placeholder.com/200?text=Exhaust', visibility: true },
      { categoryName: 'Cooling System', categoryImage: 'https://via.placeholder.com/200?text=Cooling', visibility: true },
    ]);
    console.log(`   ✓ Created ${categories.length} categories\n`);

    // 3. Seed SubCategories
    console.log('📦 Seeding SubCategories...');
    const subCategories = await SubCategory.insertMany([
      { subCategoryName: 'Spark Plugs', category: categories[0]._id, visibility: true }, // 0 - Engine Parts
      { subCategoryName: 'Air Filters', category: categories[5]._id, visibility: true }, // 1 - Filters
      { subCategoryName: 'Brake Pads', category: categories[1]._id, visibility: true }, // 2 - Brake System
      { subCategoryName: 'Shock Absorbers', category: categories[2]._id, visibility: true }, // 3 - Suspension
      { subCategoryName: 'Batteries', category: categories[3]._id, visibility: true }, // 4 - Electrical
      { subCategoryName: 'Oil Filters', category: categories[5]._id, visibility: true }, // 5 - Filters
      { subCategoryName: 'Headlights', category: categories[4]._id, visibility: true }, // 6 - Body Parts
      { subCategoryName: 'Radiator Hoses', category: categories[7]._id, visibility: true }, // 7 - Cooling System
    ]);
    console.log(`   ✓ Created ${subCategories.length} subcategories\n`);

    // 4. Seed Models (distribute across brands)
    console.log('📦 Seeding Models...');
    const modelData = [
      { name: 'Camry', brandIndex: 0 }, { name: 'Corolla', brandIndex: 0 }, { name: 'RAV4', brandIndex: 0 }, { name: 'Highlander', brandIndex: 0 },
      { name: 'Patrol', brandIndex: 1 }, { name: 'Altima', brandIndex: 1 }, { name: 'Sentra', brandIndex: 1 }, { name: 'Maxima', brandIndex: 1 },
      { name: 'Accord', brandIndex: 2 }, { name: 'Civic', brandIndex: 2 }, { name: 'CR-V', brandIndex: 2 }, { name: 'Pilot', brandIndex: 2 },
      { name: '3 Series', brandIndex: 3 }, { name: '5 Series', brandIndex: 3 }, { name: 'X3', brandIndex: 3 }, { name: 'X5', brandIndex: 3 },
      { name: 'C-Class', brandIndex: 4 }, { name: 'E-Class', brandIndex: 4 }, { name: 'GLE', brandIndex: 4 }, { name: 'S-Class', brandIndex: 4 },
      { name: 'A4', brandIndex: 5 }, { name: 'Q5', brandIndex: 5 }, { name: 'A6', brandIndex: 5 }, { name: 'Q7', brandIndex: 5 },
      { name: 'F-150', brandIndex: 6 }, { name: 'Mustang', brandIndex: 6 }, { name: 'Explorer', brandIndex: 6 },
      { name: 'Silverado', brandIndex: 7 }, { name: 'Tahoe', brandIndex: 7 }, { name: 'Equinox', brandIndex: 7 },
      { name: 'RX', brandIndex: 8 }, { name: 'ES', brandIndex: 8 }, { name: 'NX', brandIndex: 8 },
      { name: 'Elantra', brandIndex: 9 }, { name: 'Sonata', brandIndex: 9 }, { name: 'Tucson', brandIndex: 9 },
      { name: 'Optima', brandIndex: 10 }, { name: 'Sorento', brandIndex: 10 }, { name: 'Sportage', brandIndex: 10 },
      { name: 'CX-5', brandIndex: 11 }, { name: 'CX-9', brandIndex: 11 }, { name: 'Mazda3', brandIndex: 11 },
    ];
    const models = await Model.insertMany(
      modelData.map(m => ({
        modelName: m.name,
        brand: brands[m.brandIndex]._id,
        visibility: true
      }))
    );
    console.log(`   ✓ Created ${models.length} models\n`);

    // 5. Seed Years (2015-2024)
    console.log('📦 Seeding Years...');
    const years = await Year.insertMany(
      Array.from({ length: 10 }, (_, i) => ({
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

    // 7. Seed Users (20 users)
    console.log('📦 Seeding Users...');
    const hashedPassword = await bcrypt.hash('password123', 10);
    const userData = [
      { name: 'Super Admin', email: 'admin@premart.com', phone: '+971509999999', role: 'SUPER_ADMIN', verify: true },
      ...Array.from({ length: 19 }, (_, i) => ({
        name: `Customer ${i + 1}`,
        email: `customer${i + 1}@example.com`,
        phone: `+971501234${String(i).padStart(3, '0')}`,
        role: 'CUSTOMER',
        verify: Math.random() > 0.3
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

    // 8. Seed Shops (10 shops)
    console.log('📦 Seeding Shops...');
    const shopPassword = await bcrypt.hash('shop123', 10);
    const shopNames = [
      'Auto Parts Express', 'Premium Auto Supplies', 'Quick Parts Center',
      'Elite Auto Components', 'Speed Parts Hub', 'AutoZone Dubai',
      'Car Parts Warehouse', 'Pro Auto Spares', 'Gulf Auto Parts',
      'Desert Auto Components'
    ];
    const shopLocations = ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman'];
    const shops = await Shop.insertMany(
      shopNames.map((name, i) => ({
        shopeDetails: {
          shopName: name,
          shopAddress: `${randomItem(['Sheikh Zayed Road', 'Business Bay', 'Deira', 'Downtown', 'JBR'])}${i % 2 === 0 ? ', Dubai' : ', ' + randomItem(shopLocations)}`,
          shopMail: `${name.toLowerCase().replace(/\s+/g, '')}@example.ae`,
          shopContact: `+97142${String(i).padStart(6, '0')}`,
          shopLicenseNumber: `LIC-${String(i + 1).padStart(3, '0')}`,
          shopLicenseExpiry: '2025-12-31',
          EmiratesId: `784-${String(i + 1).padStart(4, '0')}-${String(i + 1).padStart(7, '0')}-${i + 1}`,
          shopLocation: randomItem(shopLocations),
          taxRegistrationNumber: `TRN-${String(i + 1).padStart(3, '0')}`,
          supportMail: `support@${name.toLowerCase().replace(/\s+/g, '')}.ae`,
          supportNumber: `+97142${String(i + 1).padStart(6, '1')}`,
          password: shopPassword
        }
      }))
    );
    console.log(`   ✓ Created ${shops.length} shops (password: shop123)\n`);

    // 9. Seed Vehicle Configurations (50 configs)
    console.log('📦 Seeding Vehicle Configurations...');
    const engineTypes = ['1.8L Petrol', '2.0L Petrol', '2.5L Petrol', '3.0L Petrol', '3.5L Petrol', '4.0L Petrol', '5.6L Petrol', '2.0L Diesel', '2.5L Diesel', '3.0L Diesel', '1.5L Turbo Petrol', '2.0L Turbo Petrol'];
    const transmissions = ['Automatic', 'CVT', 'Manual', 'DCT'];
    const frameCodes = ['XV70', 'E210', 'Y62', '10G', 'G20', 'W205', 'B9', 'P702', 'K2XX', 'RX350', 'YG', 'K5', 'CX-5'];
    const vinPatterns = ['4T1B*', 'JTDKB*', '5YJ3*', 'JN8*', '5N1*', '1N6*', '1HGCM*', '19XFC*', 'JHMCM*', 'WBA*', '5UX*', 'WBX*', 'WDD*', 'WDC*', 'WAU*', 'WVW*'];
    const trims = [['LE', 'XLE'], ['L', 'LE'], ['SE', 'LE'], ['LX', 'EX'], ['320i', '330i'], ['C200', 'C300'], ['A4', 'A4 Premium'], ['Base', 'LT'], ['RX 350', 'RX 450h']];

    const vehicleConfigs = [];
    for (let i = 0; i < 50; i++) {
      const brand = randomItem(brands);
      const brandModels = models.filter(m => m.brand.toString() === brand._id.toString());
      if (brandModels.length === 0) continue;
      const model = randomItem(brandModels);
      const year = randomInt(2018, 2024);
      
      vehicleConfigs.push({
        brand: brand._id,
        model: model._id,
        year,
        engineType: randomItem(engineTypes),
        transmission: randomItem(transmissions),
        frameCode: randomItem(frameCodes),
        region: 'GCC',
        trim: randomItem(trims),
        commonName: `${brand.brandName} ${model.modelName} ${year}`,
        vinPatterns: [randomItem(vinPatterns), randomItem(vinPatterns)],
        description: `${brand.brandName} ${model.modelName} ${year} with ${randomItem(engineTypes)} engine`,
        visibility: true,
        isActive: true
      });
    }
    const createdVehicleConfigs = await VehicleConfiguration.insertMany(vehicleConfigs);
    console.log(`   ✓ Created ${createdVehicleConfigs.length} vehicle configurations\n`);

    // 10. Seed Parts Catalog (100 parts)
    console.log('📦 Seeding Parts Catalog...');
    
    // Map part types to subcategories
    // subCategories: [0: Spark Plugs, 1: Air Filters, 2: Brake Pads, 3: Shock Absorbers, 4: Batteries, 5: Oil Filters, 6: Headlights, 7: Radiator Hoses]
    const partTypes = [
      { name: 'Spark Plug', categoryIndex: 0, subCategoryIndex: 0, prefix: 'SP' }, // Engine Parts -> Spark Plugs
      { name: 'Brake Pad Set', categoryIndex: 1, subCategoryIndex: 2, prefix: 'BP' }, // Brake System -> Brake Pads
      { name: 'Air Filter', categoryIndex: 5, subCategoryIndex: 1, prefix: 'AF' }, // Filters -> Air Filters
      { name: 'Car Battery', categoryIndex: 3, subCategoryIndex: 4, prefix: 'BAT' }, // Electrical -> Batteries
      { name: 'Shock Absorber', categoryIndex: 2, subCategoryIndex: 3, prefix: 'SH' }, // Suspension -> Shock Absorbers
      { name: 'Oil Filter', categoryIndex: 5, subCategoryIndex: 5, prefix: 'OF' }, // Filters -> Oil Filters
      { name: 'Headlight Assembly', categoryIndex: 4, subCategoryIndex: 6, prefix: 'HL' }, // Body Parts -> Headlights
      { name: 'Radiator Hose', categoryIndex: 7, subCategoryIndex: 7, prefix: 'RH' }, // Cooling System -> Radiator Hoses
      { name: 'Exhaust Muffler', categoryIndex: 6, prefix: 'EX' }, // Exhaust System (no subcategory)
      { name: 'Windshield Wiper', categoryIndex: 4, prefix: 'WW' }, // Body Parts (no subcategory)
      { name: 'Timing Belt', categoryIndex: 0, prefix: 'TB' }, // Engine Parts (no subcategory)
      { name: 'Alternator', categoryIndex: 3, prefix: 'ALT' }, // Electrical (no subcategory)
      { name: 'Starter Motor', categoryIndex: 3, prefix: 'SM' }, // Electrical (no subcategory)
      { name: 'Brake Rotor', categoryIndex: 1, prefix: 'BR' }, // Brake System (no subcategory)
      { name: 'Wheel Bearing', categoryIndex: 2, prefix: 'WB' } // Suspension (no subcategory)
    ];

    const madeIn = ['Japan', 'Germany', 'USA', 'UAE', 'China', 'Korea'];
    const partsCatalog = [];
    
    for (let i = 0; i < 100; i++) {
      const partType = randomItem(partTypes);
      const partNumber = `${partType.prefix}-${String(i + 1).padStart(3, '0')}`;
      const compatibleCount = randomInt(3, 10);
      const compatibleVehicleConfigs = [];
      for (let j = 0; j < compatibleCount; j++) {
        compatibleVehicleConfigs.push(randomItem(createdVehicleConfigs)._id);
      }
      
      // Build part data
      const partData = {
        partNumber,
        partName: `${partType.name} ${i + 1}`,
        description: `High-quality ${partType.name.toLowerCase()} for various vehicle models`,
        category: categories[partType.categoryIndex]._id,
        compatibleVehicleConfigs: [...new Set(compatibleVehicleConfigs)], // Remove duplicates
        madeIn: randomItem(madeIn),
        weight: Math.round((Math.random() * 20 + 0.1) * 100) / 100,
        dimensions: {
          length: randomInt(5, 100),
          width: randomInt(5, 50),
          height: randomInt(2, 30)
        },
        oemNumber: `OEM-${String(i + 1).padStart(5, '0')}`,
        warranty: randomItem(['6 Months', '1 Year', '2 Years', '3 Years']),
        images: [`https://via.placeholder.com/400?text=${encodeURIComponent(partType.name)}`],
        isActive: true
      };
      
      // Add subCategory if mapped
      if (partType.subCategoryIndex !== undefined && subCategories[partType.subCategoryIndex]) {
        partData.subCategory = subCategories[partType.subCategoryIndex]._id;
      }
      
      partsCatalog.push(partData);
    }
    const createdPartsCatalog = await PartsCatalog.insertMany(partsCatalog);
    console.log(`   ✓ Created ${createdPartsCatalog.length} parts in catalog\n`);

    // 11. Seed Shop Products (100 parts × 10 shops = 1000 products)
    console.log('📦 Seeding Shop Products...');
    const shopProducts = [];
    for (const shop of shops) {
      for (const part of createdPartsCatalog) {
        const basePrice = randomInt(50, 1500);
        const hasDiscount = Math.random() > 0.6;
        const discount = hasDiscount ? Math.floor(basePrice * randomInt(5, 20) / 100) : 0;
        
        shopProducts.push({
          shopId: shop._id,
          part: part._id,
          price: basePrice,
          discountedPrice: hasDiscount ? basePrice - discount : null,
          stock: randomInt(5, 200),
          isAvailable: Math.random() > 0.1 // 90% available
        });
      }
    }
    await ShopProduct.insertMany(shopProducts);
    console.log(`   ✓ Created ${shopProducts.length} shop products\n`);

    // 12. Seed Delivery Agencies (5 agencies)
    console.log('📦 Seeding Delivery Agencies...');
    const agencyPassword = await bcrypt.hash('agency123', 10);
    const agencyNames = [
      'Fast Delivery Services', 'Express Logistics', 'Quick Ship UAE',
      'Gulf Delivery Solutions', 'Premium Logistics'
    ];
    const agencies = await DeliveryAgency.insertMany(
      agencyNames.map((name, i) => ({
        agencyDetails: {
          email: `agency${i + 1}@delivery.ae`,
          password: agencyPassword,
          profileImage: `https://via.placeholder.com/200?text=Agency+${i + 1}`,
          agencyName: name,
          agencyAddress: `${randomItem(['Dubai Industrial City', 'Sharjah Industrial Area', 'Abu Dhabi Industrial Zone'])}`,
          agencyMail: `agency${i + 1}@delivery.ae`,
          agencyContact: `+97150${String(i + 1).padStart(7, '1')}`,
          agencyLicenseNumber: `DL-${String(i + 1).padStart(3, '0')}`,
          agencyLicenseExpiry: '2025-12-31',
          emiratesId: `784-${String(i + 1).padStart(4, '1')}-${String(i + 1).padStart(7, '1')}-${i + 1}`,
          agencyLocation: randomItem(['Dubai', 'Sharjah', 'Abu Dhabi']),
          supportMail: `support@${name.toLowerCase().replace(/\s+/g, '')}.ae`,
          supportNumber: `+97150${String(i + 1).padStart(7, '2')}`,
          payoutType: randomItem(['weekly', 'monthly'])
        }
      }))
    );
    console.log(`   ✓ Created ${agencies.length} delivery agencies (password: agency123)\n`);

    // 13. Seed Delivery Boys (15 boys)
    console.log('📦 Seeding Delivery Boys...');
    const deliveryBoys = await DeliveryBoy.insertMany(
      Array.from({ length: 15 }, (_, i) => ({
        name: `Delivery Boy ${i + 1}`,
        phone: `+97150${String(i + 1).padStart(7, '3')}`,
        email: `boy${i + 1}@delivery.ae`,
        agencyId: randomItem(agencies)._id,
        isOnline: Math.random() > 0.4,
        availability: Math.random() > 0.3,
        latitude: 25.0 + Math.random() * 0.5,
        longitude: 55.0 + Math.random() * 0.5,
        areaAssigned: randomItem(['Dubai Marina', 'Downtown Dubai', 'Business Bay', 'Deira', 'Sharjah', 'Abu Dhabi']),
        city: randomItem(['Dubai', 'Sharjah', 'Abu Dhabi']),
        accountVerify: Math.random() > 0.2,
        countryCode: '+971'
      }))
    );
    console.log(`   ✓ Created ${deliveryBoys.length} delivery boys\n`);

    // 14. Seed Banners (5 banners)
    console.log('📦 Seeding Banners...');
    const banners = await Banner.insertMany(
      Array.from({ length: 5 }, (_, i) => ({
        title: `Banner ${i + 1}`,
        pic: `https://via.placeholder.com/1200x400?text=Banner+${i + 1}`,
        isActive: true,
        redirectScreen: '/products',
        shopId: randomItem(shops)._id
      }))
    );
    console.log(`   ✓ Created ${banners.length} banners\n`);

    // 15. Seed Coupons (10 coupons)
    console.log('📦 Seeding Coupons...');
    const coupons = await Coupon.insertMany(
      Array.from({ length: 10 }, (_, i) => ({
        code: `COUPON${i + 1}`,
        discountValue: randomInt(10, 30),
        discountType: 'percent',
        minOrderAmount: randomInt(100, 500),
        usageLimit: randomInt(50, 500),
        startDate: new Date(),
        expiryDate: new Date(Date.now() + randomInt(30, 90) * 24 * 60 * 60 * 1000),
        isActive: Math.random() > 0.2,
        shopId: i % 3 === 0 ? null : randomItem(shops)._id // Some shop-specific, some general
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
    console.log(`   • Vehicle Configurations: ${createdVehicleConfigs.length}`);
    console.log(`   • Users: ${users.length} (password: password123)`);
    console.log(`     - Admin: admin@premart.com (SUPER_ADMIN)`);
    console.log(`   • Shops: ${shops.length} (password: shop123)`);
    console.log(`   • Parts Catalog: ${createdPartsCatalog.length}`);
    console.log(`   • Shop Products: ${shopProducts.length}`);
    console.log(`   • Delivery Agencies: ${agencies.length} (password: agency123)`);
    console.log(`   • Delivery Boys: ${deliveryBoys.length}`);
    console.log(`   • Banners: ${banners.length}`);
    console.log(`   • Coupons: ${coupons.length}`);
    console.log('\n');

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
