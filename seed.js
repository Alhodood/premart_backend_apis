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
      // Collection might not exist, which is fine
      console.log(`   ⚠ Skipped ${collectionName} (may not exist)`);
    }
  }
  
  console.log('✅ Database cleared\n');
};

const seedData = async () => {
  console.log('🌱 Seeding database...\n');

  try {
    // 1. Seed Brands
    console.log('📦 Seeding Brands...');
    const brands = await Brand.insertMany([
      { brandName: 'Toyota', brandImage: 'https://via.placeholder.com/200?text=Toyota', visibility: true },
      { brandName: 'Nissan', brandImage: 'https://via.placeholder.com/200?text=Nissan', visibility: true },
      { brandName: 'Honda', brandImage: 'https://via.placeholder.com/200?text=Honda', visibility: true },
      { brandName: 'BMW', brandImage: 'https://via.placeholder.com/200?text=BMW', visibility: true },
      { brandName: 'Mercedes-Benz', brandImage: 'https://via.placeholder.com/200?text=Mercedes', visibility: true },
      { brandName: 'Audi', brandImage: 'https://via.placeholder.com/200?text=Audi', visibility: true },
      { brandName: 'Ford', brandImage: 'https://via.placeholder.com/200?text=Ford', visibility: true },
      { brandName: 'Chevrolet', brandImage: 'https://via.placeholder.com/200?text=Chevrolet', visibility: true },
    ]);
    console.log(`   ✓ Created ${brands.length} brands\n`);

    // 2. Seed Categories
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
      { subCategoryName: 'Spark Plugs', category: categories[0]._id, visibility: true },
      { subCategoryName: 'Air Filters', category: categories[5]._id, visibility: true },
      { subCategoryName: 'Brake Pads', category: categories[1]._id, visibility: true },
      { subCategoryName: 'Shock Absorbers', category: categories[2]._id, visibility: true },
      { subCategoryName: 'Batteries', category: categories[3]._id, visibility: true },
    ]);
    console.log(`   ✓ Created ${subCategories.length} subcategories\n`);

    // 4. Seed Models
    console.log('📦 Seeding Models...');
    const models = await Model.insertMany([
      { modelName: 'Camry', brand: brands[0]._id, visibility: true },
      { modelName: 'Corolla', brand: brands[0]._id, visibility: true },
      { modelName: 'Patrol', brand: brands[1]._id, visibility: true },
      { modelName: 'Altima', brand: brands[1]._id, visibility: true },
      { modelName: 'Accord', brand: brands[2]._id, visibility: true },
      { modelName: 'Civic', brand: brands[2]._id, visibility: true },
      { modelName: '3 Series', brand: brands[3]._id, visibility: true },
      { modelName: '5 Series', brand: brands[3]._id, visibility: true },
      { modelName: 'C-Class', brand: brands[4]._id, visibility: true },
      { modelName: 'E-Class', brand: brands[4]._id, visibility: true },
    ]);
    console.log(`   ✓ Created ${models.length} models\n`);

    // 5. Seed Years
    console.log('📦 Seeding Years...');
    const years = await Year.insertMany([
      { year: '2024', visibility: true },
      { year: '2023', visibility: true },
      { year: '2022', visibility: true },
      { year: '2021', visibility: true },
      { year: '2020', visibility: true },
      { year: '2019', visibility: true },
      { year: '2018', visibility: true },
      { year: '2017', visibility: true },
      { year: '2016', visibility: true },
      { year: '2015', visibility: true },
    ]);
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

    // 7. Seed Users
    console.log('📦 Seeding Users...');
    const hashedPassword = await bcrypt.hash('password123', 10);
    const users = await User.insertMany([
      {
        name: 'John Doe',
        email: 'john.doe@example.com',
        phone: '+971501234567',
        password: hashedPassword,
        accountVisibility: true,
        accountVerify: true,
        role: 'CUSTOMER',
        address: [{
          name: 'John Doe',
          address: '123 Main Street, Dubai',
          contact: '+971501234567',
          area: 'Dubai Marina',
          place: 'Dubai',
          default: true,
          addressType: 'Home',
          latitude: 25.0772,
          longitude: 55.1398
        }]
      },
      {
        name: 'Jane Smith',
        email: 'jane.smith@example.com',
        phone: '+971507654321',
        password: hashedPassword,
        accountVisibility: true,
        accountVerify: true,
        role: 'CUSTOMER',
      },
      {
        name: 'Super Admin',
        email: 'admin@premart.com',
        phone: '+971509999999',
        password: hashedPassword,
        accountVisibility: true,
        accountVerify: true,
        role: 'SUPER_ADMIN',
      },
    ]);
    console.log(`   ✓ Created ${users.length} users (password: password123)\n`);

    // 8. Seed Shops
    console.log('📦 Seeding Shops...');
    const shopPassword = await bcrypt.hash('shop123', 10);
    const shops = await Shop.insertMany([
      {
        shopeDetails: {
          shopName: 'Auto Parts Express',
          shopAddress: 'Sheikh Zayed Road, Dubai',
          shopMail: 'contact@autopartsexpress.ae',
          shopContact: '+97142234567',
          shopLicenseNumber: 'LIC-001',
          shopLicenseExpiry: '2025-12-31',
          EmiratesId: '784-1234-5678901-1',
          shopLocation: 'Dubai',
          taxRegistrationNumber: 'TRN-001',
          supportMail: 'support@autopartsexpress.ae',
          supportNumber: '+97142234568',
          password: shopPassword,
          shopBankDetails: {
            bankName: 'Emirates NBD',
            accountNumber: '1234567890',
            ibanNuber: 'AE123456789012345678901',
            branch: 'Dubai Main',
            swiftCode: 'EBILAEAD'
          }
        }
      },
      {
        shopeDetails: {
          shopName: 'Premium Auto Supplies',
          shopAddress: 'Business Bay, Dubai',
          shopMail: 'info@premiumauto.ae',
          shopContact: '+97142345678',
          shopLicenseNumber: 'LIC-002',
          shopLicenseExpiry: '2025-12-31',
          EmiratesId: '784-2345-6789012-2',
          shopLocation: 'Dubai',
          taxRegistrationNumber: 'TRN-002',
          supportMail: 'support@premiumauto.ae',
          supportNumber: '+97142345679',
          password: shopPassword,
        }
      },
      {
        shopeDetails: {
          shopName: 'Quick Parts Center',
          shopAddress: 'Deira, Dubai',
          shopMail: 'sales@quickparts.ae',
          shopContact: '+97142456789',
          shopLicenseNumber: 'LIC-003',
          shopLicenseExpiry: '2025-12-31',
          EmiratesId: '784-3456-7890123-3',
          shopLocation: 'Dubai',
          taxRegistrationNumber: 'TRN-003',
          supportMail: 'support@quickparts.ae',
          supportNumber: '+97142456790',
          password: shopPassword,
        }
      },
    ]);
    console.log(`   ✓ Created ${shops.length} shops (password: shop123)\n`);

    // 9. Seed Vehicle Configurations (needed for PartsCatalog)
    console.log('📦 Seeding Vehicle Configurations...');
    const vehicleConfigs = await VehicleConfiguration.insertMany([
      {
        brand: brands[0]._id, // Toyota
        model: models[0]._id, // Camry
        year: 2023,
        engineType: '2.5L Petrol',
        transmission: 'Automatic',
        frameCode: 'XV70',
        region: 'GCC',
        trim: ['LE', 'XLE'],
        commonName: 'Toyota Camry 2023',
        vinPatterns: ['4T1B*', 'JTDKB*', '5YJ3*'],
        description: 'Toyota Camry 2023 with 2.5L Petrol engine and Automatic transmission',
        visibility: true,
        isActive: true
      },
      {
        brand: brands[0]._id, // Toyota
        model: models[1]._id, // Corolla
        year: 2023,
        engineType: '1.8L Petrol',
        transmission: 'CVT',
        frameCode: 'E210',
        region: 'GCC',
        trim: ['L', 'LE'],
        commonName: 'Toyota Corolla 2023',
        vinPatterns: ['JTDKB*', '4T1B*', '5YJ3*'],
        description: 'Toyota Corolla 2023 with 1.8L Petrol engine and CVT transmission',
        visibility: true,
        isActive: true
      },
      {
        brand: brands[1]._id, // Nissan
        model: models[2]._id, // Patrol
        year: 2023,
        engineType: '5.6L Petrol',
        transmission: 'Automatic',
        frameCode: 'Y62',
        region: 'GCC',
        trim: ['SE', 'LE'],
        commonName: 'Nissan Patrol 2023',
        vinPatterns: ['JN8*', '5N1*', '1N6*'],
        description: 'Nissan Patrol 2023 with 5.6L Petrol engine and Automatic transmission',
        visibility: true,
        isActive: true
      },
      {
        brand: brands[2]._id, // Honda
        model: models[4]._id, // Accord
        year: 2022,
        engineType: '1.5L Turbo Petrol',
        transmission: 'CVT',
        frameCode: '10G',
        region: 'GCC',
        trim: ['LX', 'EX'],
        commonName: 'Honda Accord 2022',
        vinPatterns: ['1HGCM*', '19XFC*', 'JHMCM*'],
        description: 'Honda Accord 2022 with 1.5L Turbo Petrol engine and CVT transmission',
        visibility: true,
        isActive: true
      },
      {
        brand: brands[3]._id, // BMW
        model: models[6]._id, // 3 Series
        year: 2023,
        engineType: '2.0L Turbo Petrol',
        transmission: 'Automatic',
        frameCode: 'G20',
        region: 'GCC',
        trim: ['320i', '330i'],
        commonName: 'BMW 3 Series 2023',
        vinPatterns: ['WBA*', '5UX*', 'WBX*'],
        description: 'BMW 3 Series 2023 with 2.0L Turbo Petrol engine and Automatic transmission',
        visibility: true,
        isActive: true
      },
    ]);
    console.log(`   ✓ Created ${vehicleConfigs.length} vehicle configurations\n`);

    // 10. Seed Parts Catalog
    console.log('📦 Seeding Parts Catalog...');
    const partsCatalog = await PartsCatalog.insertMany([
      {
        partNumber: 'SP-001',
        partName: 'NGK Spark Plug',
        description: 'High-performance spark plug for petrol engines',
        category: categories[0]._id,
        compatibleVehicleConfigs: [vehicleConfigs[0]._id, vehicleConfigs[1]._id, vehicleConfigs[3]._id],
        madeIn: 'Japan',
        weight: 0.05,
        dimensions: { length: 10, width: 2, height: 2 },
        oemNumber: 'NGK-12345',
        warranty: '1 Year',
        images: ['https://via.placeholder.com/400?text=Spark+Plug'],
        isActive: true
      },
      {
        partNumber: 'BF-001',
        partName: 'Premium Brake Pad Set',
        description: 'Ceramic brake pads for superior stopping power',
        category: categories[1]._id,
        compatibleVehicleConfigs: [vehicleConfigs[0]._id, vehicleConfigs[2]._id, vehicleConfigs[4]._id],
        madeIn: 'Germany',
        weight: 1.5,
        dimensions: { length: 15, width: 10, height: 3 },
        oemNumber: 'BP-67890',
        warranty: '2 Years',
        images: ['https://via.placeholder.com/400?text=Brake+Pads'],
        isActive: true
      },
      {
        partNumber: 'AF-001',
        partName: 'High Flow Air Filter',
        description: 'Performance air filter for better engine breathing',
        category: categories[5]._id,
        compatibleVehicleConfigs: [vehicleConfigs[0]._id, vehicleConfigs[1]._id, vehicleConfigs[2]._id, vehicleConfigs[3]._id],
        madeIn: 'USA',
        weight: 0.3,
        dimensions: { length: 20, width: 20, height: 5 },
        oemNumber: 'AF-11111',
        warranty: '6 Months',
        images: ['https://via.placeholder.com/400?text=Air+Filter'],
        isActive: true
      },
      {
        partNumber: 'BAT-001',
        partName: '12V Car Battery',
        description: 'Maintenance-free car battery with 2-year warranty',
        category: categories[3]._id,
        compatibleVehicleConfigs: [vehicleConfigs[0]._id, vehicleConfigs[1]._id, vehicleConfigs[3]._id, vehicleConfigs[4]._id],
        madeIn: 'UAE',
        weight: 15,
        dimensions: { length: 25, width: 17, height: 19 },
        oemNumber: 'BAT-22222',
        warranty: '2 Years',
        images: ['https://via.placeholder.com/400?text=Battery'],
        isActive: true
      },
      {
        partNumber: 'SH-001',
        partName: 'Premium Shock Absorber',
        description: 'Gas-filled shock absorber for smooth ride',
        category: categories[2]._id,
        compatibleVehicleConfigs: [vehicleConfigs[2]._id, vehicleConfigs[4]._id],
        madeIn: 'Japan',
        weight: 3.5,
        dimensions: { length: 50, width: 8, height: 8 },
        oemNumber: 'SH-33333',
        warranty: '1 Year',
        images: ['https://via.placeholder.com/400?text=Shock+Absorber'],
        isActive: true
      },
      {
        partNumber: 'OF-001',
        partName: 'Oil Filter',
        description: 'High-quality oil filter for regular maintenance',
        category: categories[5]._id, // Filters
        compatibleVehicleConfigs: [vehicleConfigs[0]._id, vehicleConfigs[1]._id, vehicleConfigs[2]._id, vehicleConfigs[3]._id, vehicleConfigs[4]._id],
        madeIn: 'USA',
        weight: 0.2,
        dimensions: { length: 8, width: 8, height: 6 },
        oemNumber: 'OF-44444',
        warranty: '6 Months',
        images: ['https://via.placeholder.com/400?text=Oil+Filter'],
        isActive: true
      },
      {
        partNumber: 'WF-001',
        partName: 'Windshield Wiper Blades',
        description: 'Premium windshield wiper blades set',
        category: categories[4]._id, // Body Parts
        compatibleVehicleConfigs: [vehicleConfigs[0]._id, vehicleConfigs[1]._id, vehicleConfigs[3]._id],
        madeIn: 'Germany',
        weight: 0.3,
        dimensions: { length: 60, width: 2, height: 1 },
        oemNumber: 'WF-55555',
        warranty: '1 Year',
        images: ['https://via.placeholder.com/400?text=Wiper+Blades'],
        isActive: true
      },
      {
        partNumber: 'RB-001',
        partName: 'Radiator Hose',
        description: 'Cooling system radiator hose',
        category: categories[7]._id, // Cooling System
        compatibleVehicleConfigs: [vehicleConfigs[0]._id, vehicleConfigs[2]._id, vehicleConfigs[4]._id],
        madeIn: 'Japan',
        weight: 0.4,
        dimensions: { length: 40, width: 5, height: 5 },
        oemNumber: 'RH-66666',
        warranty: '1 Year',
        images: ['https://via.placeholder.com/400?text=Radiator+Hose'],
        isActive: true
      },
      {
        partNumber: 'EX-001',
        partName: 'Exhaust Muffler',
        description: 'Performance exhaust muffler',
        category: categories[6]._id, // Exhaust System
        compatibleVehicleConfigs: [vehicleConfigs[2]._id, vehicleConfigs[4]._id],
        madeIn: 'USA',
        weight: 8.5,
        dimensions: { length: 80, width: 25, height: 20 },
        oemNumber: 'EX-77777',
        warranty: '2 Years',
        images: ['https://via.placeholder.com/400?text=Exhaust+Muffler'],
        isActive: true
      },
    ]);
    console.log(`   ✓ Created ${partsCatalog.length} parts in catalog\n`);

    // 10. Seed Shop Products
    console.log('📦 Seeding Shop Products...');
    const shopProducts = [];
    for (const shop of shops) {
      for (const part of partsCatalog) {
        const basePrice = Math.floor(Math.random() * 500) + 50; // Random price between 50-550
        const discount = Math.random() > 0.5 ? Math.floor(basePrice * 0.1) : 0;
        shopProducts.push({
          shopId: shop._id,
          part: part._id,
          price: basePrice,
          discountedPrice: discount > 0 ? basePrice - discount : null,
          stock: Math.floor(Math.random() * 100) + 10,
          isAvailable: true
        });
      }
    }
    await ShopProduct.insertMany(shopProducts);
    console.log(`   ✓ Created ${shopProducts.length} shop products\n`);

    // 12. Seed Delivery Agencies
    console.log('📦 Seeding Delivery Agencies...');
    const agencyPassword = await bcrypt.hash('agency123', 10);
    const agencies = await DeliveryAgency.insertMany([
      {
        agencyDetails: {
          email: 'agency1@delivery.ae',
          password: agencyPassword,
          profileImage: 'https://via.placeholder.com/200?text=Agency+1',
          agencyName: 'Fast Delivery Services',
          agencyAddress: 'Dubai Industrial City',
          agencyMail: 'agency1@delivery.ae',
          agencyContact: '+971501111111',
          agencyLicenseNumber: 'DL-001',
          agencyLicenseExpiry: '2025-12-31',
          emiratesId: '784-1111-1111111-1',
          agencyLocation: 'Dubai',
          supportMail: 'support@fastdelivery.ae',
          supportNumber: '+971501111112',
          payoutType: 'weekly',
        }
      },
      {
        agencyDetails: {
          email: 'agency2@delivery.ae',
          password: agencyPassword,
          profileImage: 'https://via.placeholder.com/200?text=Agency+2',
          agencyName: 'Express Logistics',
          agencyAddress: 'Sharjah Industrial Area',
          agencyMail: 'agency2@delivery.ae',
          agencyContact: '+971502222222',
          agencyLicenseNumber: 'DL-002',
          agencyLicenseExpiry: '2025-12-31',
          emiratesId: '784-2222-2222222-2',
          agencyLocation: 'Sharjah',
          supportMail: 'support@expresslogistics.ae',
          supportNumber: '+971502222223',
          payoutType: 'monthly',
        }
      },
    ]);
    console.log(`   ✓ Created ${agencies.length} delivery agencies (password: agency123)\n`);

    // 13. Seed Delivery Boys
    console.log('📦 Seeding Delivery Boys...');
    const deliveryBoys = await DeliveryBoy.insertMany([
      {
        name: 'Ahmed Ali',
        phone: '+971503333333',
        email: 'ahmed@delivery.ae',
        agencyId: agencies[0]._id,
        isOnline: true,
        availability: true,
        latitude: 25.2048,
        longitude: 55.2708,
        areaAssigned: 'Dubai Marina',
        city: 'Dubai',
        accountVerify: true,
        countryCode: '+971',
      },
      {
        name: 'Mohammed Hassan',
        phone: '+971504444444',
        email: 'mohammed@delivery.ae',
        agencyId: agencies[0]._id,
        isOnline: false,
        availability: false,
        latitude: 25.2764,
        longitude: 55.2962,
        areaAssigned: 'Downtown Dubai',
        city: 'Dubai',
        accountVerify: true,
        countryCode: '+971',
      },
      {
        name: 'Omar Khalid',
        phone: '+971505555555',
        email: 'omar@delivery.ae',
        agencyId: agencies[1]._id,
        isOnline: true,
        availability: true,
        latitude: 25.3573,
        longitude: 55.4033,
        areaAssigned: 'Sharjah',
        city: 'Sharjah',
        accountVerify: true,
        countryCode: '+971',
      },
    ]);
    console.log(`   ✓ Created ${deliveryBoys.length} delivery boys\n`);

    // 14. Seed Banners
    console.log('📦 Seeding Banners...');
    const banners = await Banner.insertMany([
      {
        title: 'Summer Sale 2024',
        pic: 'https://via.placeholder.com/1200x400?text=Summer+Sale',
        isActive: true,
        redirectScreen: '/products?category=all',
        shopId: shops[0]._id,
      },
      {
        title: 'New Arrivals',
        pic: 'https://via.placeholder.com/1200x400?text=New+Arrivals',
        isActive: true,
        redirectScreen: '/products?new=true',
        shopId: shops[1]._id,
      },
    ]);
    console.log(`   ✓ Created ${banners.length} banners\n`);

    // 15. Seed Coupons
    console.log('📦 Seeding Coupons...');
    const coupons = await Coupon.insertMany([
      {
        code: 'WELCOME10',
        discountValue: 10,
        discountType: 'percent',
        minOrderAmount: 100,
        usageLimit: 100,
        startDate: new Date(),
        expiryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
        isActive: true,
        shopId: shops[0]._id,
      },
      {
        code: 'SAVE20',
        discountValue: 20,
        discountType: 'percent',
        minOrderAmount: 200,
        usageLimit: 50,
        startDate: new Date(),
        expiryDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
        isActive: true,
        shopId: shops[1]._id,
      },
    ]);
    console.log(`   ✓ Created ${coupons.length} coupons\n`);

    console.log('\n✅ Database seeding completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`   • Brands: ${brands.length}`);
    console.log(`   • Categories: ${categories.length}`);
    console.log(`   • SubCategories: ${subCategories.length}`);
    console.log(`   • Models: ${models.length}`);
    console.log(`   • Years: ${years.length}`);
    console.log(`   • Fuel Types: ${fuels.length}`);
    console.log(`   • Vehicle Configurations: ${vehicleConfigs.length}`);
    console.log(`   • Users: ${users.length} (password: password123)`);
    console.log(`     - Admin: admin@premart.com (SUPER_ADMIN)`);
    console.log(`   • Shops: ${shops.length} (password: shop123)`);
    console.log(`   • Parts Catalog: ${partsCatalog.length}`);
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
