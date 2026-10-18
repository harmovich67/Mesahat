import { models, sequelize } from '../models/index.js';
import { hashPassword } from '../services/auth.js';
import { ROLE_DEFS, PERMISSIONS, ALL_PERMISSIONS } from '../config/permissions.js';
import { SETTINGS_DEFAULTS } from '../config/settingsDefaults.js';
import { storage } from '../storage/index.js';

export async function seed({ force = false } = {}) {
  console.log('[seed] starting seed...');

  // 1. Settings
  for (const [key, value] of Object.entries(SETTINGS_DEFAULTS)) {
    // Never overwrite values an admin has already saved.
    await models.Setting.findOrCreate({ where: { key }, defaults: { key, value } });
  }

  // 2. Permissions & Roles
  const permMap = new Map();
  for (const [group, keys] of Object.entries(PERMISSIONS)) {
    for (const key of keys) {
      const [p] = await models.Permission.findOrCreate({
        where: { key },
        defaults: { key, group, description: { ar: key, en: key } },
      });
      permMap.set(key, p);
    }
  }

  const roleMap = new Map();
  for (const def of ROLE_DEFS) {
    const [r] = await models.Role.findOrCreate({
      where: { key: def.key },
      defaults: {
        key: def.key,
        name: def.name,
        is_system: true,
      },
    });
    roleMap.set(def.key, r);

    // Assign permissions
    const permsToAssign = def.permissions.includes('*')
      ? Array.from(permMap.values())
      : def.permissions.map((pk) => permMap.get(pk)).filter(Boolean);
    await r.setPermissions(permsToAssign);
  }

  // The demo catalogue is only for a brand-new database. On every later boot, keep whatever the admins
  // have edited (prices, wallet numbers, coupons, settings…) instead of resetting it to the demo values.
  if (!force && (await models.Space.count()) > 0) {
    console.log('[seed] existing data found — keeping it');
    return;
  }

  // 3. Staff and Customers
  const adminPw = await hashPassword('Admin@123456');
  const userPw = await hashPassword('User@123456');

  const [adminUser] = await models.User.findOrCreate({
    where: { email: 'admin@workora.com' },
    defaults: {
      name: 'أحمد الفقي',
      email: 'admin@workora.com',
      phone: '+201001234567',
      password_hash: adminPw,
      locale: 'ar',
      is_staff: true,
      company: 'WORKORA Headquarters',
      status: 'active',
    },
  });
  await adminUser.setRoles([roleMap.get('owner')]);

  const [reviewerUser] = await models.User.findOrCreate({
    where: { email: 'reviewer@workora.com' },
    defaults: {
      name: 'مريم حسن',
      email: 'reviewer@workora.com',
      phone: '+201098765432',
      password_hash: adminPw,
      locale: 'ar',
      is_staff: true,
      company: 'WORKORA Operations',
      status: 'active',
    },
  });
  await reviewerUser.setRoles([roleMap.get('payment_reviewer')]);

  const [customer1] = await models.User.findOrCreate({
    where: { email: 'omar@example.com' },
    defaults: {
      name: 'عمر الشريف',
      email: 'omar@example.com',
      phone: '+201012345678',
      password_hash: userPw,
      locale: 'ar',
      is_staff: false,
      company: 'نايل تكنولوجي (Nile Tech)',
      status: 'active',
    },
  });

  const [customer2] = await models.User.findOrCreate({
    where: { email: 'nour@example.com' },
    defaults: {
      name: 'نور الدين سامي',
      email: 'nour@example.com',
      phone: '+201123456789',
      password_hash: userPw,
      locale: 'ar',
      is_staff: false,
      company: 'كايرو ديزاين لاب (Cairo Design Lab)',
      status: 'active',
    },
  });

  // 4. Locations
  const locCairo = await models.Location.upsert({
    slug: 'new-cairo-fifth-settlement',
    name: { ar: 'فرع التجمع الخامس - القاهرة الجديدة', en: 'New Cairo - Fifth Settlement' },
    address: { ar: 'شارع التسعين الشمالي، مجمع الأعمال سيكتور 4', en: 'North 90th St, Sector 4 Business Park' },
    city: { ar: 'القاهرة الجديدة', en: 'New Cairo' },
    latitude: 30.0289,
    longitude: 31.4721,
    description: {
      ar: 'موقع استراتيجي هادئ في قلب التجمع الخامس، مجهز بأحدث البنى التحتية وإطلالات بانورامية مفتوحة ومواقف سيارات خاصة.',
      en: 'Prime location in the heart of Fifth Settlement with state-of-the-art facilities and open views.',
    },
    images: ['/images/hero.jpg'],
    working_hours: { opens: '08:00', closes: '23:00' },
    phone: '+20 2 2813 4400',
    email: 'newcairo@workora.com',
    active: true,
  }).then(([l]) => l);

  const locNasrCity = await models.Location.upsert({
    slug: 'nasr-city-makram',
    name: { ar: 'فرع مدينة نصر - مكرم عبيد', en: 'Nasr City - Makram Ebeid' },
    address: { ar: 'تقاطع شارع مكرم عبيد مع طريق النصر، برج الصفوة', en: 'Makram Ebeid intersection with Al-Nasr Rd' },
    city: { ar: 'القاهرة', en: 'Cairo' },
    latitude: 30.0612,
    longitude: 31.3392,
    description: {
      ar: 'موقع حيوي يربط شرق القاهرة، قريب من كافة وسائل المواصلات والخدمات المصرفية والمطاعم.',
      en: 'Vibrant hub in East Cairo near transportation and major business services.',
    },
    images: ['/images/meeting-room.jpg'],
    working_hours: { opens: '08:30', closes: '22:30' },
    phone: '+20 2 2271 8890',
    email: 'nasrcity@workora.com',
    active: true,
  }).then(([l]) => l);

  const locAlex = await models.Location.upsert({
    slug: 'alexandria-corniche',
    name: { ar: 'فرع الإسكندرية - سابا باشا', en: 'Alexandria - Saba Pasha Corniche' },
    address: { ar: 'طريق الجيش، الكورنيش، مجمع البلازا الطبي والإداري', en: 'El Geish Rd, Corniche, Plaza Complex' },
    city: { ar: 'الإسكندرية', en: 'Alexandria' },
    latitude: 31.2335,
    longitude: 29.9541,
    description: {
      ar: 'مساحة عمل استثنائية بإطلالة مباشرة ومفتوحة على البحر الأبيض المتوسط، تمنحك إلهامًا وهدوءًا لا مثيل له.',
      en: 'Exceptional beachfront workspace overlooking the Mediterranean Sea.',
    },
    images: ['/images/event.jpg'],
    working_hours: { opens: '09:00', closes: '22:00' },
    phone: '+20 3 5842 110',
    email: 'alex@workora.com',
    active: true,
  }).then(([l]) => l);

  // 5. Space Types
  const typeMeeting = await models.SpaceType.upsert({
    key: 'meeting_room',
    group: 'meeting-rooms',
    name: { ar: 'قاعات اجتماعات', en: 'Meeting Rooms' },
    description: { ar: 'قاعات مجهزة بشاشات ذكية وألواح كتابة لفرق العمل والاجتماعات الاستراتيجية.', en: 'Smart screens and tools for productive meetings.' },
    icon: 'Users',
    color: '#1F4D3F',
    sort: 1,
    active: true,
  }).then(([t]) => t);

  const typeCoworking = await models.SpaceType.upsert({
    key: 'coworking_desk',
    group: 'coworking',
    name: { ar: 'مكاتب عمل مشتركة', en: 'Coworking Desks' },
    description: { ar: 'مساحات عمل مفتوحة ومحفزة للتركيز، للمستقلين وفرق العمل المرنة.', en: 'Inspiring open desks with ergonomic comfort.' },
    icon: 'Laptop',
    color: '#2F7D5B',
    sort: 2,
    active: true,
  }).then(([t]) => t);

  const typeOffice = await models.SpaceType.upsert({
    key: 'private_office',
    group: 'private-offices',
    name: { ar: 'مكاتب خاصة للشركات', en: 'Private Offices' },
    description: { ar: 'مكاتب مغلقة مؤمنة بعزل صوتي وتجهيزات فاخرة لفرق العمل والمؤسسات.', en: 'Private furnished office suites for teams.' },
    icon: 'Building2',
    color: '#C9803A',
    sort: 3,
    active: true,
  }).then(([t]) => t);

  const typeConference = await models.SpaceType.upsert({
    key: 'conference_room',
    group: 'meeting-rooms',
    name: { ar: 'قاعات مؤتمرات كبرى', en: 'Conference Rooms' },
    description: { ar: 'قاعات اجتماعات تنفيذية بمستوى مجالس الإدارة مع كاميرات 360 درجة.', en: 'Executive boardroom style conference suites.' },
    icon: 'Presentation',
    color: '#7C5C3B',
    sort: 4,
    active: true,
  }).then(([t]) => t);

  const typeTraining = await models.SpaceType.upsert({
    key: 'training_room',
    group: 'meeting-rooms',
    name: { ar: 'قاعات تدريب وورش عمل', en: 'Training Rooms' },
    description: { ar: 'قاعات تدريب مهيأة بكافة أدوات العرض التفاعلية وأنظمة الصوت.', en: 'Equipped halls for workshops and masterclasses.' },
    icon: 'GraduationCap',
    color: '#4361EE',
    sort: 5,
    active: true,
  }).then(([t]) => t);

  const typeEvent = await models.SpaceType.upsert({
    key: 'event_space',
    group: 'coworking',
    name: { ar: 'مساحات فعاليات ولقاءات', en: 'Event Spaces' },
    description: { ar: 'مساحات واسعة مصممة لإطلاق المنتجات ولقاءات ريادة الأعمال والندوات.', en: 'Spacious venues for networking and showcases.' },
    icon: 'Sparkles',
    color: '#8A2BE2',
    sort: 6,
    active: true,
  }).then(([t]) => t);

  // 6. Amenities
  const amenitiesList = [
    { key: 'high_speed_wifi', name: { ar: 'إنترنت فائق السرعة (ألياف ضوئية)', en: 'High-speed Optical Fiber WiFi' }, icon: 'Wifi' },
    { key: 'smart_tv', name: { ar: 'شاشة ذكية 4K تدعم البث اللاسلكي', en: '4K Smart Presentation Screen' }, icon: 'Tv' },
    { key: 'whiteboard', name: { ar: 'لوح أبيض زجاجي مغناطيسي', en: 'Glass Magnetic Whiteboard' }, icon: 'Edit3' },
    { key: 'specialty_coffee', name: { ar: 'قهوة مختصة ومشروبات ساخنة مجانية', en: 'Complimentary Specialty Coffee' }, icon: 'Coffee' },
    { key: 'ac', name: { ar: 'تكييف هواء مركزي عالي الكفاءة', en: 'Central Air Conditioning' }, icon: 'Wind' },
    { key: 'video_conferencing', name: { ar: 'نظام فيديو كونفرنس 360° مع إلغاء الضوضاء', en: '360° Noise-Cancelling Video System' }, icon: 'Video' },
    { key: 'ergonomic_chairs', name: { ar: 'مقاعد مريحة طبية معتمدة', en: 'Ergonomic Designer Chairs' }, icon: 'Armchair' },
    { key: 'reception', name: { ar: 'استقبال مهني وخدمة ضيوف', en: 'Professional Reception & Concierge' }, icon: 'ShieldCheck' },
    { key: 'parking', name: { ar: 'مواقف سيارات خاصة مجانية للعملاء', en: 'Private Reserved Parking' }, icon: 'Car' },
    { key: 'printing', name: { ar: 'خدمات طباعة ومسح ضوئي ليزري', en: 'Laser Printing & Document Center' }, icon: 'Printer' },
  ];

  const amenityMap = new Map();
  for (const item of amenitiesList) {
    const [a] = await models.Amenity.findOrCreate({
      where: { key: item.key },
      defaults: { ...item, active: true },
    });
    amenityMap.set(item.key, a);
  }

  // 7. Add-Ons
  const addOnsList = [
    {
      name: { ar: 'باقة ضيافة باريستا بريميوم', en: 'Premium Barista Beverage Service' },
      description: { ar: 'خدمة ضيافة مستمرة تتضمن تشكيلة قهوة مختصة وشاي أعشاب ومياه معدنية فاخرة طوال فترة الحجز.', en: 'Unlimited specialty coffee, tea, and premium bottled water throughout your booking.' },
      price: 180,
      pricing_mode: 'per_booking',
      max_quantity: 5,
      active: true,
      sort: 1,
    },
    {
      name: { ar: 'تجهيز مؤتمرات فيديو واستوديو بث 4K', en: 'Studio-Grade 4K Conference Stream Kit' },
      description: { ar: 'إعداد احترافي لميكروفونات الرقبة وإضاءة استوديو ناعمة لتصوير البودكاست واجتماعات مجلس الإدارة.', en: 'Professional lavalier mics and softbox lighting for top-tier calls.' },
      price: 320,
      pricing_mode: 'per_booking',
      max_quantity: 2,
      active: true,
      sort: 2,
    },
    {
      name: { ar: 'وجبات عمل خفيفة طازجة (للفرد)', en: 'Fresh Executive Business Lunch Box' },
      description: { ar: 'تشكيلة سندوتشات جورميه وسلطة طازجة وحلوى خفيفة مع عصير طبيعي لكل فرد.', en: 'Gourmet sandwich, salad, dessert and cold-pressed juice per person.' },
      price: 160,
      pricing_mode: 'per_person',
      max_quantity: 30,
      active: true,
      sort: 3,
    },
    {
      name: { ar: 'حزمة طباعة مستندات ملونة (100 ورقة)', en: 'High-Volume Color Printing Pack (100 Sheets)' },
      description: { ar: 'طباعة ليزر فاخرة ملونة عالية الدقة مع تغليف حراري اختياري.', en: 'High-yield color laser prints with presentation binding.' },
      price: 90,
      pricing_mode: 'per_booking',
      max_quantity: 10,
      active: true,
      sort: 4,
    },
  ];

  for (const ao of addOnsList) {
    await models.AddOn.findOrCreate({
      where: { 'name.ar': ao.name.ar },
      defaults: ao,
    });
  }

  // 8. Payment Methods (Vodafone Cash & InstaPay)
  await models.PaymentMethod.upsert({
    code: 'vodafone_cash',
    name: { ar: 'فودافون كاش (Vodafone Cash)', en: 'Vodafone Cash' },
    account_identifier: '01023456789',
    account_name: 'Workora Coworking Hub',
    instructions: {
      ar: 'قم بتحويل المبلغ الإجمالي المطلوب عبر محفظة فودافون كاش إلى الرقم الموضح أعلاه (01023456789). بعد إتمام التحويل، يرجى رفع لقطة شاشة لإيصال التحويل وتسجيل وقت المعاملة لمطابقتها وتأكيد حجزك.',
      en: 'Transfer the total amount via Vodafone Cash wallet to 01023456789. Upload your payment screenshot and time for quick verification.',
    },
    active: true,
    sort: 1,
  });

  await models.PaymentMethod.upsert({
    code: 'instapay',
    name: { ar: 'إنستاباي (InstaPay)', en: 'InstaPay' },
    account_identifier: 'workora@instapay',
    account_name: 'WORKORA WORKSPACES SAE',
    instructions: {
      ar: 'قم بالتحويل عبر تطبيق إنستاباي إلى العنوان workora@instapay أو باستخدام التحويل الفوري للحساب البنكي. ارفع صورة إشعار التحويل البنكي أو لقطة شاشة من تطبيق إنستاباي لتأكيد الحجز فورًا.',
      en: 'Transfer via InstaPay app to workora@instapay. Upload the transfer screenshot to verify your booking.',
    },
    active: true,
    sort: 2,
  });

  // 9. Coupons
  await models.Coupon.upsert({
    code: 'WELCOME20',
    description: { ar: 'خصم ترحيبي 20% على حجزك الأول', en: '20% Welcome discount on your first booking' },
    discount_type: 'percentage',
    value: 20,
    max_discount: 300,
    min_amount: 250,
    active: true,
    per_user_limit: 1,
  });

  await models.Coupon.upsert({
    code: 'WORKORA10',
    description: { ar: 'خصم 10% لجميع رواد الأعمال', en: '10% discount for all workspace reservations' },
    discount_type: 'percentage',
    value: 10,
    max_discount: 500,
    min_amount: 100,
    active: true,
    per_user_limit: 5,
  });

  await models.Coupon.upsert({
    code: 'STARTUP100',
    description: { ar: 'خصم ثابت 100 ج.م على الحجوزات اليومية', en: 'Flat 100 EGP discount on bookings above 600 EGP' },
    discount_type: 'fixed',
    value: 100,
    min_amount: 600,
    active: true,
  });

  // 10. Spaces Creation Helper
  const allAmenityIds = Array.from(amenityMap.values()).map((a) => a.id);

  async function createOrUpdateSpace(data) {
    const { prices, images, amenities, hours, ...spaceFields } = data;
    const [space] = await models.Space.upsert(spaceFields);

    if (images?.length) {
      await models.SpaceImage.destroy({ where: { space_id: space.id } });
      await models.SpaceImage.bulkCreate(images.map((url, idx) => ({
        space_id: space.id,
        url,
        sort: idx,
      })));
    }

    if (amenities?.length) {
      await space.setAmenities(amenities.map((k) => amenityMap.get(k)?.id).filter(Boolean));
    }

    if (prices?.length) {
      await models.PricingRule.destroy({ where: { space_id: space.id } });
      await models.PricingRule.bulkCreate(prices.map((p) => ({ ...p, space_id: space.id })));
    }

    await models.AvailabilityRule.destroy({ where: { space_id: space.id } });
    const standardHours = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
      space_id: space.id,
      weekday,
      opens: '08:30',
      closes: '22:30',
      is_closed: false,
    }));
    await models.AvailabilityRule.bulkCreate(standardHours);

    return space;
  }

  // Space 1: قاعة اجتماعات النيل A (Meeting Room)
  const spaceMeetingA = await createOrUpdateSpace({
    slug: 'nile-meeting-room-a',
    name: { ar: 'قاعة اجتماعات النيل الفاخرة (Nile Room A)', en: 'Nile Executive Meeting Room A' },
    description: {
      ar: 'قاعة اجتماعات راقية تتسع لـ 8 أشخاص مع إطلالة مفتوحة وإضاءة طبيعية دافئة. مجهزة بشاشة ذكية 65 بوصة 4K، لوح زجاجي تفاعلي، وطاولة بيضاوية من خشب البلوط الطبيعي مع مقاعد مريحة.',
      en: 'Premium meeting room seating 8 with natural sunlight, 4K display, whiteboard, and oak wood conference table.',
    },
    rules: [
      { ar: 'يرجى الالتزام بالموعد المحدد للحجز لضمان جودة الخدمة للمستخدم التالي.', en: 'Please respect booking slots.' },
      { ar: 'المشروبات الساخنة والباردة متوفرة في صالة الضيافة المجاورة.', en: 'Hot drinks available in adjacent lounge.' },
    ],
    type_id: typeMeeting.id,
    location_id: locCairo.id,
    capacity: 8,
    units: 1,
    area_sqm: 26,
    floor: 'الطابق الثاني',
    status: 'active',
    featured: true,
    rating_avg: 4.95,
    rating_count: 24,
    images: ['/images/meeting-room.jpg', '/images/hero.jpg'],
    amenities: ['high_speed_wifi', 'smart_tv', 'whiteboard', 'specialty_coffee', 'ac', 'video_conferencing', 'ergonomic_chairs', 'reception'],
    prices: [
      { unit: 'hourly', kind: 'base', amount: 350, active: true },
      { unit: 'half_day', kind: 'base', amount: 1250, active: true },
      { unit: 'full_day', kind: 'base', amount: 2200, active: true },
      { unit: 'daily', kind: 'base', amount: 2200, active: true },
    ],
  });

  // Space 2: الواحة للمكاتب المشتركة (Coworking Desks)
  const spaceCoworking = await createOrUpdateSpace({
    slug: 'al-waha-coworking-hub',
    name: { ar: 'مساحة العمل المشتركة - الواحة (Al-Waha Coworking)', en: 'Al-Waha Open Coworking Desks' },
    description: {
      ar: 'مساحة عمل مفتوحة هادئة وملهمة ومجهزة بـ 24 مكتبًا مصممًا هندسيًا، محاطة بالنباتات الخضراء الطبيعية، ومقابس طاقة مدمجة لكل مقعد، وسرعات إنترنت قياسية لمطوري البرمجيات والمصممين.',
      en: 'Peaceful open workspace with 24 dedicated desks, greenery, fast fiber internet, and ergonomic chairs.',
    },
    rules: [
      { ar: 'الرجاء استخدام السماعات عند إجراء المكالمات الصوتية حفاظًا على هدوء المكان.', en: 'Please use headphones for voice calls.' },
    ],
    type_id: typeCoworking.id,
    location_id: locCairo.id,
    capacity: 24,
    units: 24,
    area_sqm: 140,
    floor: 'الطابق الأرضي والحديقة',
    status: 'active',
    featured: true,
    rating_avg: 4.88,
    rating_count: 46,
    images: ['/images/coworking.jpg', '/images/hero.jpg'],
    amenities: ['high_speed_wifi', 'specialty_coffee', 'ac', 'ergonomic_chairs', 'reception', 'printing', 'parking'],
    prices: [
      { unit: 'hourly', kind: 'base', amount: 65, active: true },
      { unit: 'daily', kind: 'base', amount: 180, active: true },
      { unit: 'weekly', kind: 'base', amount: 950, active: true },
      { unit: 'monthly', kind: 'base', amount: 2900, active: true },
    ],
  });

  // Space 3: مكتب خاص لفرق العمل (Private Office)
  const spacePrivateOffice = await createOrUpdateSpace({
    slug: 'skyline-private-suite',
    name: { ar: 'مكتب خاص للفرق الإبداعية (Creative Team Suite)', en: 'Creative Team Private Office' },
    description: {
      ar: 'مكتب مستقل هادئ معزول صوتيًا بالكامل، مخصص لفرق العمل المكونة من 4 إلى 6 أفراد، يشتمل على ركن استقبال خاص، خزائن حفظ ملفات مؤمنة، وشاشة عرض جدارية.',
      en: 'Soundproofed private office for teams of 4 to 6 people, equipped with lounge corner and private storage.',
    },
    rules: [
      { ar: 'دخول مخصص بالمفتاح الذكي 24/7 لأعضاء الفريق.', en: 'Smart card 24/7 key access.' },
    ],
    type_id: typeOffice.id,
    location_id: locNasrCity.id,
    capacity: 6,
    units: 1,
    area_sqm: 38,
    floor: 'الطابق الرابع',
    status: 'active',
    featured: true,
    rating_avg: 4.92,
    rating_count: 18,
    images: ['/images/private-office.jpg', '/images/hero.jpg'],
    amenities: ['high_speed_wifi', 'smart_tv', 'whiteboard', 'specialty_coffee', 'ac', 'ergonomic_chairs', 'reception', 'parking'],
    prices: [
      { unit: 'daily', kind: 'base', amount: 850, active: true },
      { unit: 'weekly', kind: 'base', amount: 4800, active: true },
      { unit: 'monthly', kind: 'base', amount: 16500, active: true },
    ],
  });

  // Space 4: قاعة المؤتمرات الكبرى (Conference Hall)
  const spaceConference = await createOrUpdateSpace({
    slug: 'grand-boardroom-conference',
    name: { ar: 'قاعة المؤتمرات ومجالس الإدارة (Grand Boardroom)', en: 'Grand Boardroom & Conference' },
    description: {
      ar: 'قاعة مؤتمرات تنفيذية فخمة تتسع لـ 16 شخصًا، مكسوة بخشب الجوز الراقي، مزودة بنظام فيديو كونفرنس استوديو متطور وكاميرات تتبع المتحدث تلقائيًا.',
      en: 'Prestigious boardroom seating 16 with walnut wood finishes, studio mic system, and smart acoustic panels.',
    },
    rules: [
      { ar: 'يرجى التنسيق المسبق مع فريق الاستقبال في حال الحاجة لضيافة خاصة.', en: 'Coordinate catering with front desk in advance.' },
    ],
    type_id: typeConference.id,
    location_id: locCairo.id,
    capacity: 16,
    units: 1,
    area_sqm: 54,
    floor: 'الطابق الثالث',
    status: 'active',
    featured: true,
    rating_avg: 5.0,
    rating_count: 31,
    images: ['/images/conference.jpg', '/images/meeting-room.jpg'],
    amenities: ['high_speed_wifi', 'smart_tv', 'whiteboard', 'specialty_coffee', 'ac', 'video_conferencing', 'ergonomic_chairs', 'reception', 'parking'],
    prices: [
      { unit: 'hourly', kind: 'base', amount: 650, active: true },
      { unit: 'half_day', kind: 'base', amount: 2400, active: true },
      { unit: 'full_day', kind: 'base', amount: 4200, active: true },
    ],
  });

  // Space 5: قاعة التدريب التفاعلية (Training Room)
  const spaceTraining = await createOrUpdateSpace({
    slug: 'interactive-training-hall',
    name: { ar: 'قاعة ورش العمل والتدريب التفاعلية', en: 'Interactive Training & Masterclass Hall' },
    description: {
      ar: 'قاعة تدريب مجهزة تتسع لـ 20 متدربًا، مع مقاعد مرنة يمكن إعادة ترتيبها على شكل حرف U أو صفوف محاضرات، بروجيكتور ليزر 4K فائق السطوع ولوح أبيض ذكي كبير.',
      en: 'Versatile training space for 20 seats with reconfigurable desks and ultra-bright laser projection.',
    },
    rules: [
      { ar: 'إمكانية تعديل توزيع المقاعد بالتنسيق مع المشرف الفني قبل الجلسة بنصف ساعة.', en: 'Seat reconfiguration available 30 min before.' },
    ],
    type_id: typeTraining.id,
    location_id: locAlex.id,
    capacity: 20,
    units: 1,
    area_sqm: 65,
    floor: 'الطابق الأول (إطلالة بحرية)',
    status: 'active',
    featured: false,
    rating_avg: 4.85,
    rating_count: 14,
    images: ['/images/training.jpg', '/images/event.jpg'],
    amenities: ['high_speed_wifi', 'smart_tv', 'whiteboard', 'specialty_coffee', 'ac', 'ergonomic_chairs', 'printing'],
    prices: [
      { unit: 'hourly', kind: 'base', amount: 480, active: true },
      { unit: 'half_day', kind: 'base', amount: 1800, active: true },
      { unit: 'full_day', kind: 'base', amount: 3200, active: true },
    ],
  });

  // Space 6: قاعة الفعاليات الكبرى (Event Space)
  const spaceEvent = await createOrUpdateSpace({
    slug: 'skyline-events-hall',
    name: { ar: 'صالة الفعاليات والملتقيات الكبرى (Skyline Events)', en: 'Skyline Community & Event Hall' },
    description: {
      ar: 'مساحة استثنائية مفتوحة مصممة لاستضافة لقاءات الشركات، الندوات الثقافية، إطلاق المشاريع الناشئة وحفلات التواصل المهني، تتسع لأكثر من 50 شخصًا بإضاءة سينمائية دافئة ونظام صوتي محيطي.',
      en: 'Stunning open venue for networking, startup launch events, and panel discussions for up to 50 guests.',
    },
    rules: [
      { ar: 'الحجز يتضمن التجهيز الصوتي المبدئي وفريق الدعم الفني خلال الفعالية.', en: 'Includes basic sound tech support.' },
    ],
    type_id: typeEvent.id,
    location_id: locCairo.id,
    capacity: 50,
    units: 1,
    area_sqm: 160,
    floor: 'الروف البانورامي',
    status: 'active',
    featured: true,
    rating_avg: 4.97,
    rating_count: 39,
    images: ['/images/event.jpg', '/images/hero.jpg'],
    amenities: ['high_speed_wifi', 'smart_tv', 'specialty_coffee', 'ac', 'reception', 'parking'],
    prices: [
      { unit: 'hourly', kind: 'base', amount: 1200, active: true },
      { unit: 'half_day', kind: 'base', amount: 4500, active: true },
      { unit: 'full_day', kind: 'base', amount: 8000, active: true },
    ],
  });

  // 11. Sample Bookings & Payments Demonstration
  // Booking 1: BK-10280 (Pending Verification with receipt uploaded - Vodafone Cash)
  const b1Start = new Date(Date.now() + 2 * 86400000); // 2 days ahead
  b1Start.setHours(10, 0, 0, 0);
  const b1End = new Date(b1Start.getTime() + 3 * 3600000); // 3 hours

  const [booking1] = await models.Booking.findOrCreate({
    where: { booking_number: 'BK-10280' },
    defaults: {
      booking_number: 'BK-10280',
      user_id: customer1.id,
      space_id: spaceMeetingA.id,
      location_id: locCairo.id,
      start_at: b1Start,
      end_at: b1End,
      duration_minutes: 180,
      unit: 'hourly',
      unit_slot: 1,
      guest_count: 5,
      base_amount: 1050,
      addon_amount: 180,
      discount_amount: 0,
      tax_amount: 0,
      final_amount: 1230,
      currency: 'EGP',
      status: 'payment_under_review',
      source: 'online',
    },
  });

  const [pay1] = await models.Payment.findOrCreate({
    where: { booking_id: booking1.id },
    defaults: {
      booking_id: booking1.id,
      method: 'vodafone_cash',
      amount: 1230,
      currency: 'EGP',
      status: 'under_review',
      transfer_reference: 'VF-99812401',
      transfer_time: new Date(Date.now() - 3600000),
      sender_info: '01012345678 (عمر الشريف)',
      submitted_at: new Date(Date.now() - 3600000),
    },
  });

  // Dummy receipt for demo verification
  await models.PaymentReceipt.findOrCreate({
    where: { payment_id: pay1.id },
    defaults: {
      payment_id: pay1.id,
      file_path: 'receipts/demo_receipt_sample.png',
      original_name: 'vodafone_cash_receipt_1230egp.png',
      mime_type: 'image/png',
      file_size: 142850,
      uploaded_by: customer1.id,
      is_current: true,
    },
  });

  // Booking 2: BK-10281 (Confirmed & Approved - InstaPay)
  const b2Start = new Date(Date.now() + 86400000);
  b2Start.setHours(14, 0, 0, 0);
  const b2End = new Date(b2Start.getTime() + 2 * 3600000);

  const [booking2] = await models.Booking.findOrCreate({
    where: { booking_number: 'BK-10281' },
    defaults: {
      booking_number: 'BK-10281',
      user_id: customer2.id,
      space_id: spaceConference.id,
      location_id: locCairo.id,
      start_at: b2Start,
      end_at: b2End,
      duration_minutes: 120,
      unit: 'hourly',
      unit_slot: 1,
      guest_count: 10,
      base_amount: 1300,
      addon_amount: 0,
      discount_amount: 130, // WORKORA10
      tax_amount: 0,
      final_amount: 1170,
      currency: 'EGP',
      status: 'confirmed',
      coupon_code: 'WORKORA10',
      source: 'online',
    },
  });

  await models.Payment.findOrCreate({
    where: { booking_id: booking2.id },
    defaults: {
      booking_id: booking2.id,
      method: 'instapay',
      amount: 1170,
      currency: 'EGP',
      status: 'approved',
      transfer_reference: 'IP-554201829',
      transfer_time: new Date(Date.now() - 7200000),
      sender_info: 'nour_sami@instapay',
      submitted_at: new Date(Date.now() - 7200000),
      reviewed_at: new Date(Date.now() - 3600000),
      reviewed_by: reviewerUser.id,
    },
  });

  // Booking 3: BK-10282 (Completed with 5-star review)
  const b3Start = new Date(Date.now() - 2 * 86400000);
  b3Start.setHours(11, 0, 0, 0);
  const b3End = new Date(b3Start.getTime() + 4 * 3600000);

  const [booking3] = await models.Booking.findOrCreate({
    where: { booking_number: 'BK-10282' },
    defaults: {
      booking_number: 'BK-10282',
      user_id: customer1.id,
      space_id: spaceMeetingA.id,
      location_id: locCairo.id,
      start_at: b3Start,
      end_at: b3End,
      duration_minutes: 240,
      unit: 'half_day',
      unit_slot: 1,
      guest_count: 6,
      base_amount: 1250,
      addon_amount: 0,
      discount_amount: 0,
      tax_amount: 0,
      final_amount: 1250,
      currency: 'EGP',
      status: 'completed',
      source: 'online',
    },
  });

  await models.Review.findOrCreate({
    where: { booking_id: booking3.id },
    defaults: {
      booking_id: booking3.id,
      user_id: customer1.id,
      space_id: spaceMeetingA.id,
      rating: 5,
      comment: 'تجربة فوق الممتازة! القاعة هادئة جدًا، الشاشة والواي فاي سريعة للغاية، وطاقم الاستقبال كان في قمة الاحترافية والترحيب. سنكرر الحجز أسبوعيًا بالتأكيد.',
      status: 'approved',
      featured: true,
    },
  });

  console.log('[seed] database seeded successfully with rich demo data!');
}

if (process.argv[1]?.endsWith('seed.js')) {
  seed({ force: true }).then(() => process.exit(0)).catch((err) => {
    console.error('[seed] error:', err);
    process.exit(1);
  });
}
