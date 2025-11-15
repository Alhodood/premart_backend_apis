// smoke.js
import { getCatalogs, getCarById, getCatalogs as dummy } from './inject.cjs';

async function run() {
  try {
    console.log("API_KEY loaded:", !!process.env.PARTS_API_KEY);
    const catalogs = await getCatalogs();
    console.log("Catalog count:", Array.isArray(catalogs) ? catalogs.length : typeof catalogs);
    if (Array.isArray(catalogs) && catalogs[0]) {
      console.log("Example catalog:", catalogs[0].id || catalogs[0].name || catalogs[0]);
    }
    // If you know a catalog id + sample carId, test the other call:
    // const car = await getCarById('bmw', 'someCarId');
    // console.log('car', car);
  } catch (err) {
    console.error("Smoke error:", err.message || err);
    process.exit(1);
  }
}
run();