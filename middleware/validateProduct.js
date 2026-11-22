
const validateProduct = (req, res, next) => {
    const {
        name,
        sku,
        category,
        price,
        quantity,
        reorderLevel,
        supplier
    } = req.body;

    if (
        !name || !sku || !category ||
        price === undefined ||
        quantity === undefined ||
        reorderLevel === undefined ||
        !supplier
    ) {
        return res.status(400).json({
            success: false,
            message: "All product fields are required"
        });
    }

    if (
        typeof name !== "string" ||
        typeof sku !== "string" ||
        typeof category !== "string" ||
        typeof supplier !== "string"
    ) {
        return res.status(400).json({
            success: false,
            message: "Name, SKU, category and supplier must be text"
        });
    }

    if (
        !Number.isFinite(price) ||
        !Number.isFinite(quantity) ||
        !Number.isFinite(reorderLevel) ||
        price < 0 ||
        quantity < 0 ||
        reorderLevel < 0
    ) {
        return res.status(400).json({
            success: false,
            message: "Price, quantity and reorder level must be valid non-negative numbers"
        });
    }

    next();
};

module.exports = validateProduct;