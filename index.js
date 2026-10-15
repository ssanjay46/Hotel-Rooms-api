
const express = require("express");

const app = express();
app.use(express.json());

const rooms = [];
let nextId = 1;

const TYPES = ["Single", "Double", "Suite", "Deluxe", "Family"];
const FIELDS = [
    "name", "location", "type", "pricePerNight",
    "capacity", "available", "roomNumber"
];
const SORT_FIELDS = ["name", "pricePerNight", "capacity"];
const QUERY_FIELDS = [
    "page", "limit", "search", "type", "available",
    "minPricePerNight", "maxPricePerNight", "sort", "order"
];

function isPlainObject(v) {
    return v !== null && typeof v === "object" && !Array.isArray(v);
}

function checkText(body, field, min, max) {
    if (typeof body[field] !== "string")
        return { error: field + " must be a string" };

    const value = body[field].trim();

    if (value.length < min || value.length > max)
        return { error: field + " must be " + min + " to " + max + " characters" };

    return { value };
}

const validators = {
    name: b => checkText(b, "name", 3, 60),
    location: b => checkText(b, "location", 2, 40),

    type: b => {
        if (typeof b.type !== "string" || !TYPES.includes(b.type))
            return { error: "Invalid type" };
        return { value: b.type };
    },

    pricePerNight: b => {
        const v = b.pricePerNight;
        if (typeof v !== "number" || !Number.isFinite(v) ||
            v <= 0 || v > 100000)
            return { error: "Invalid pricePerNight" };
        return { value: v };
    },

    capacity: b => {
        const v = b.capacity;
        if (typeof v !== "number" || !Number.isInteger(v) ||
            v < 1 || v > 10)
            return { error: "Invalid capacity" };
        return { value: v };
    },

    available: b => {
        if (typeof b.available !== "boolean")
            return { error: "available must be true or false" };
        return { value: b.available };
    },

    roomNumber: b => checkText(b, "roomNumber", 4, 20)
};

function validateBody(body, partial = false, currentId = null) {
    if (!isPlainObject(body))
        return { error: "Request body must be a JSON object" };

    const clean = {};
    let count = 0;

    for (const field of FIELDS) {
        if (!Object.prototype.hasOwnProperty.call(body, field)) {
            if (!partial)
                return { error: field + " is required" };
            continue;
        }

        count++;
        const result = validators[field](body);

        if (result.error) return result;
        clean[field] = result.value;
    }

    if (partial && count === 0)
        return { error: "Send at least one field to update" };

    if (clean.roomNumber !== undefined) {
        const duplicate = rooms.some(r =>
            r.id !== currentId &&
            r.roomNumber.toLowerCase() === clean.roomNumber.toLowerCase()
        );

        if (duplicate)
            return { error: "roomNumber already exists", status: 409 };
    }

    return { value: clean };
}

function findIndex(id) {
    return rooms.findIndex(r => String(r.id) === id);
}

function toRecord(id, data) {
    const record = { id };
    for (const field of FIELDS) record[field] = data[field];
    return record;
}

function sendError(res, result) {
    return res.status(result.status || 400).json({ error: result.error });
}

function parsePositiveInt(text) {
    if (typeof text !== "string" || !/^\d+$/.test(text))
        return null;
    const n = Number(text);
    return Number.isSafeInteger(n) && n >= 1 ? n : null;
}

function parseNumber(text) {
    if (typeof text !== "string" || text.trim() === "")
        return null;
    const n = Number(text);
    return Number.isFinite(n) ? n : null;
}

// POST: create a room
app.post("/api/rooms", (req, res) => {
    const result = validateBody(req.body);

    if (result.error) return sendError(res, result);

    const room = toRecord(nextId++, result.value);
    rooms.push(room);

    return res.status(201).json(room);
});

// GET: list rooms, search, filters, sorting, pagination
app.get("/api/rooms", (req, res) => {
    const q = req.query;

    if (Object.keys(q).some(k => !QUERY_FIELDS.includes(k)))
        return res.status(400).json({ error: "Invalid query parameter" });

    let page = q.page === undefined ? 1 : parsePositiveInt(q.page);
    let limit = q.limit === undefined ? 10 : parsePositiveInt(q.limit);

    if (page === null || limit === null || limit > 50)
        return res.status(400).json({ error: "Invalid page or limit" });

    if (q.type !== undefined && !TYPES.includes(q.type))
        return res.status(400).json({ error: "Invalid type" });

    if (q.available !== undefined &&
        q.available !== "true" && q.available !== "false")
        return res.status(400).json({ error: "Invalid available" });

    let min = null;
    let max = null;

    if (q.minPricePerNight !== undefined) {
        min = parseNumber(q.minPricePerNight);
        if (min === null)
            return res.status(400).json({ error: "Invalid minimum price" });
    }

    if (q.maxPricePerNight !== undefined) {
        max = parseNumber(q.maxPricePerNight);
        if (max === null)
            return res.status(400).json({ error: "Invalid maximum price" });
    }

    if (q.sort !== undefined && !SORT_FIELDS.includes(q.sort))
        return res.status(400).json({ error: "Invalid sort field" });

    if (q.order !== undefined &&
        q.order !== "asc" && q.order !== "desc")
        return res.status(400).json({ error: "Invalid order" });

    if (q.order !== undefined && q.sort === undefined)
        return res.status(400).json({ error: "order requires sort" });

    let list = [...rooms];

    if (q.type !== undefined)
        list = list.filter(r => r.type === q.type);

    if (q.available !== undefined)
        list = list.filter(r => r.available === (q.available === "true"));

    if (min !== null)
        list = list.filter(r => r.pricePerNight >= min);

    if (max !== null)
        list = list.filter(r => r.pricePerNight <= max);

    if (min !== null && max !== null && min > max)
        list = [];

    if (q.search !== undefined && q.search.trim() !== "") {
        const term = q.search.trim().toLowerCase();
        list = list.filter(r =>
            r.name.toLowerCase().includes(term) ||
            r.location.toLowerCase().includes(term)
        );
    }

    if (q.sort !== undefined) {
        const field = q.sort;
        const direction = q.order === "desc" ? -1 : 1;

        list.sort((a, b) => {
            let x = a[field];
            let y = b[field];

            if (typeof x === "string") {
                x = x.toLowerCase();
                y = y.toLowerCase();
            }

            if (x < y) return -1 * direction;
            if (x > y) return 1 * direction;
            return 0;
        });
    }

    const total = list.length;
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
    const start = (page - 1) * limit;

    return res.status(200).json({
        data: list.slice(start, start + limit),
        page,
        limit,
        total,
        totalPages
    });
});

// GET: one room by ID
app.get("/api/rooms/:id", (req, res) => {
    const i = findIndex(req.params.id);

    if (i === -1)
        return res.status(404).json({ error: "Record not found" });

    return res.status(200).json(rooms[i]);
});

// PUT: replace all room fields
app.put("/api/rooms/:id", (req, res) => {
    const i = findIndex(req.params.id);

    if (i === -1)
        return res.status(404).json({ error: "Record not found" });

    const result = validateBody(req.body, false, rooms[i].id);
    if (result.error) return sendError(res, result);

    rooms[i] = toRecord(rooms[i].id, result.value);
    return res.status(200).json(rooms[i]);
});

// PATCH: update selected fields
app.patch("/api/rooms/:id", (req, res) => {
    const i = findIndex(req.params.id);

    if (i === -1)
        return res.status(404).json({ error: "Record not found" });

    const result = validateBody(req.body, true, rooms[i].id);
    if (result.error) return sendError(res, result);

    rooms[i] = toRecord(rooms[i].id, {
        ...rooms[i],
        ...result.value
    });

    return res.status(200).json(rooms[i]);
});

// DELETE: remove a room
app.delete("/api/rooms/:id", (req, res) => {
    const i = findIndex(req.params.id);

    if (i === -1)
        return res.status(404).json({ error: "Record not found" });

    rooms.splice(i, 1);
    return res.status(204).end();
});

// Unknown routes
app.use((req, res) => {
    return res.status(404).json({ error: "Route not found" });
});

// Malformed JSON
app.use((err, req, res, next) => {
    if (err && err.type === "entity.parse.failed")
        return res.status(400).json({ error: "Malformed JSON body" });

    if (err)
        return res.status(400).json({ error: "Bad request" });

    next();
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
    console.log("Hotel Rooms API listening on port " + PORT);
});
