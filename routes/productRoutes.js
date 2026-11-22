
const express = require("express");
const router = express.Router();

const Product = require("../models/Product");
const validateProduct = require("../middleware/validateProduct");

// ==========================================
// 1. CREATE PRODUCT
// POST /api/products
// ==========================================

router.post("/", validateProduct, async (req, res, next) => {
    try {
        const product = await Product.create(req.body);

        res.status(201).json({
            message: "Product created successfully",
            product
        });
    } catch (error) {
        next(error);
    }
});


// ==========================================
// 2. GET ALL PRODUCTS
// Filtering, Sorting and Pagination
// GET /api/products
// ==========================================

router.get("/", async (req, res, next) => {
    try {
        const {
            category,
            minPrice,
            maxPrice,
            sortBy = "createdAt",
            order = "desc",
            page = 1,
            limit = 10
        } = req.query;

        const pageNumber = Number(page);
        const limitNumber = Number(limit);

        if (
            !Number.isInteger(pageNumber) || pageNumber < 1 ||
            !Number.isInteger(limitNumber) || limitNumber < 1 ||
            limitNumber > 100
        ) {
            return res.status(400).json({
                message: "Invalid page or limit"
            });
        }

        const allowedSortFields = [
            "name", "price", "quantity", "createdAt"
        ];

        if (!allowedSortFields.includes(sortBy)) {
            return res.status(400).json({
                message: "Invalid sort field"
            });
        }

        if (!["asc", "desc"].includes(order)) {
            return res.status(400).json({
                message: "Order must be asc or desc"
            });
        }

        const filter = {};

        if (category) {
            filter.category = category;
        }

        if (minPrice !== undefined || maxPrice !== undefined) {
            filter.price = {};

            if (minPrice !== undefined) {
                filter.price.$gte = Number(minPrice);
            }

            if (maxPrice !== undefined) {
                filter.price.$lte = Number(maxPrice);
            }
        }

        const sortOrder = order === "asc" ? 1 : -1;

        const products = await Product.find(filter)
            .sort({ [sortBy]: sortOrder })
            .skip((pageNumber - 1) * limitNumber)
            .limit(limitNumber);

        const total = await Product.countDocuments(filter);

        res.status(200).json({
            total,
            page: pageNumber,
            totalPages: Math.ceil(total / limitNumber),
            count: products.length,
            products
        });

    } catch (error) {
        next(error);
    }
});


// ==========================================
// 3. LOW STOCK REPORT
// GET /api/products/low-stock
// ==========================================

router.get("/low-stock", async (req, res, next) => {
    try {
        const lowStockItems = await Product.find({
            $expr: {
                $lte: ["$quantity", "$reorderLevel"]
            }
        });

        res.status(200).json({
            count: lowStockItems.length,
            lowStockItems
        });

    } catch (error) {
        next(error);
    }
});


// ==========================================
// 4. CATEGORY-WISE INVENTORY SUMMARY
// GET /api/products/summary
// ==========================================

router.get("/summary", async (req, res, next) => {
    try {
        const summary = await Product.aggregate([
            {
                $group: {
                    _id: "$category",

                    totalItems: {
                        $sum: 1
                    },

                    totalQuantity: {
                        $sum: "$quantity"
                    },

                    totalStockValue: {
                        $sum: {
                            $multiply: ["$price", "$quantity"]
                        }
                    },

                    avgPrice: {
                        $avg: "$price"
                    }
                }
            }
        ]);

        res.status(200).json({
            categories: summary.length,
            summary
        });

    } catch (error) {
        next(error);
    }
});


// ==========================================
// 5. OLD LOW STOCK REPORT ROUTE
// GET /api/products/reports/low-stock
// ==========================================

router.get("/reports/low-stock", async (req, res, next) => {
    try {
        const lowStockItems = await Product.find({
            $expr: {
                $lte: ["$quantity", "$reorderLevel"]
            }
        });

        res.status(200).json({
            count: lowStockItems.length,
            lowStockItems
        });

    } catch (error) {
        next(error);
    }
});


// ==========================================
// 6. OLD CATEGORY SUMMARY ROUTE
// GET /api/products/reports/category-summary
// ==========================================

router.get("/reports/category-summary", async (req, res, next) => {
    try {
        const summary = await Product.aggregate([
            {
                $group: {
                    _id: "$category",
                    totalProducts: { $sum: 1 },
                    totalQuantity: { $sum: "$quantity" },
                    totalValue: {
                        $sum: {
                            $multiply: ["$price", "$quantity"]
                        }
                    }
                }
            }
        ]);

        res.status(200).json({
            summary
        });

    } catch (error) {
        next(error);
    }
});


// ==========================================
// 7. STOCK ADJUSTMENT
// PATCH /api/products/:id/stock
// Positive change = Restock
// Negative change = Sale
// ==========================================

router.patch("/:id/stock", async (req, res, next) => {
    try {
        const change = Number(req.body.change);

        if (!Number.isFinite(change) || change === 0) {
            return res.status(400).json({
                message: "Change must be a non-zero number"
            });
        }

        const filter = {
            _id: req.params.id
        };

        if (change < 0) {
            filter.quantity = {
                $gte: Math.abs(change)
            };
        }

        const product = await Product.findOneAndUpdate(
            filter,
            {
                $inc: {
                    quantity: change
                }
            },
            {
                new: true,
                runValidators: true
            }
        );

        if (!product) {
            return res.status(404).json({
                message: "Product not found or insufficient stock"
            });
        }

        res.status(200).json({
            message: "Stock updated successfully",
            product
        });

    } catch (error) {
        next(error);
    }
});


// ==========================================
// 8. RESTOCK PRODUCT
// PATCH /api/products/:id/restock
// ==========================================

router.patch("/:id/restock", async (req, res, next) => {
    try {
        const quantity = Number(req.body.quantity);

        if (!Number.isInteger(quantity) || quantity <= 0) {
            return res.status(400).json({
                message: "Enter a valid positive quantity"
            });
        }

        const product = await Product.findByIdAndUpdate(
            req.params.id,
            {
                $inc: { quantity: quantity }
            },
            { new: true }
        );

        if (!product) {
            return res.status(404).json({
                message: "Product not found"
            });
        }

        res.status(200).json({
            message: "Stock restocked successfully",
            product
        });

    } catch (error) {
        next(error);
    }
});


// ==========================================
// 9. SALE PRODUCT
// PATCH /api/products/:id/sale
// ==========================================

router.patch("/:id/sale", async (req, res, next) => {
    try {
        const quantity = Number(req.body.quantity);

        if (!Number.isInteger(quantity) || quantity <= 0) {
            return res.status(400).json({
                message: "Enter a valid positive quantity"
            });
        }

        const product = await Product.findOneAndUpdate(
            {
                _id: req.params.id,
                quantity: { $gte: quantity }
            },
            {
                $inc: { quantity: -quantity }
            },
            { new: true }
        );

        if (!product) {
            return res.status(404).json({
                message: "Product not found or insufficient stock"
            });
        }

        res.status(200).json({
            message: "Sale completed successfully",
            product
        });

    } catch (error) {
        next(error);
    }
});


// ==========================================
// 10. GET SINGLE PRODUCT BY ID
// GET /api/products/:id
// ==========================================

router.get("/:id", async (req, res, next) => {
    try {
        const product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).json({
                message: "Product not found"
            });
        }

        res.status(200).json(product);

    } catch (error) {
        next(error);
    }
});


// ==========================================
// 11. UPDATE PRODUCT
// PUT /api/products/:id
// ==========================================
router.put("/:id", validateProduct, async (req, res, next) => {
    try {
        const product = await Product.findByIdAndUpdate(
            req.params.id,
            req.body,
            {
                new: true,
                runValidators: true
            }
        );

        if (!product) {
            return res.status(404).json({
                message: "Product not found"
            });
        }

        res.status(200).json({
            message: "Product updated successfully",
            product
        });

    } catch (error) {
        next(error);
    }
});


// ==========================================
// 12. DELETE PRODUCT
// DELETE /api/products/:id
// ==========================================

router.delete("/:id", async (req, res, next) => {
    try {
        const product = await Product.findByIdAndDelete(req.params.id);

        if (!product) {
            return res.status(404).json({
                message: "Product not found"
            });
        }

        res.status(200).json({
            message: "Product deleted successfully",
            id: product._id
        });

    } catch (error) {
        next(error);
    }
});


module.exports = router;