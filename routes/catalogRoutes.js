const express = require("express");
const Catalog = require("../models/Catalog.js");
const Car = require("../models/Car.js");
const Group = require("../models/Group.js");
const Part = require("../models/Part.js");

const router = express.Router();

// Get all catalogs
router.get("/catalogs", async (req, res) => {
  res.json(await Catalog.find());
});

// Get cars for a catalog
router.get("/catalogs/:catalogId/cars", async (req, res) => {
  res.json(await Car.find({ catalogId: req.params.catalogId }));
});

// Get groups for a car
router.get("/catalogs/:catalogId/cars/:carId/groups", async (req, res) => {
  res.json(await Group.find({ catalogId: req.params.catalogId, carId: req.params.carId }));
});

// Get parts for a group
router.get("/catalogs/:catalogId/cars/:carId/groups/:groupId/parts", async (req, res) => {
  res.json(
    await Part.find({
      catalogId: req.params.catalogId,
      carId: req.params.carId,
      groupId: req.params.groupId,
    })
  );
});

module.exports = router;