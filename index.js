const generatePreview = require("./preview.js");
const Database = require("better-sqlite3");
const db = new Database("data/circuits.db");
const fs = require("fs");

const URL_BASE = "https://wiregame.bithole.dev";

db.exec(`CREATE TABLE IF NOT EXISTS circuits (
    id INTEGER PRIMARY KEY,
    title STRING NOT NULL,
    data STRING NOT NULL,
    views INTEGER DEFAULT 0,
    cells INTEGER NOT NULL,
    previewExists INTEGER DEFAULT 0
)`);

const getCircuitStmt = db.prepare("SELECT * FROM circuits WHERE id = ?");
const addCircuitStmt = db.prepare("INSERT INTO circuits (title, data, cells, previewExists) VALUES (?, ?, ?, 1)")
const incrementViewsStmt = db.prepare("UPDATE circuits SET views = views + 1 WHERE id = ?");
const getMostViewedCircuitsStmt = db.prepare("SELECT id, title, views, cells FROM circuits ORDER BY views DESC"),
      getMostCellsCircuitsStmt = db.prepare("SELECT id, title, views, cells FROM circuits ORDER BY cells DESC"),
      getNewestCircuitsStmt = db.prepare("SELECT id, title, views, cells FROM circuits ORDER BY id DESC");

const updatePreviewStatusStmt = db.prepare("UPDATE circuits SET previewExists = 1 WHERE id = ?");
const generateMissingPreviews = async () => {
    for(const circuit of db.prepare("SELECT * FROM circuits WHERE previewExists = 0").all()) {
        console.log("Generating missing preview for circuit " + circuit.id);
        await generatePreview(circuit.data, circuit.id);
        updatePreviewStatusStmt.run(circuit.id);
    }
};

generateMissingPreviews();

const express = require("express");
const bodyParser = require("body-parser");
const app = express();

app.use(bodyParser.json());
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    next();
});

app.post("/circuit", async (req, res) => {
    
    try {

        let title = String(req.body.title).trim(),
            data = String(req.body.data);

        if(title.length == 0) title = "Untitled Circuit";
        if(!data.match(/^(?:-?\d+,-?\d+,\d+;)*-?\d+,-?\d+,\d+$/)) {
            return res.sendStatus(400);
        }

        const numCells = data.split(';').length;
        const {lastInsertRowid} = addCircuitStmt.run(title, data, numCells);
        await generatePreview(data, lastInsertRowid);
        res.json(lastInsertRowid);

    } catch(err) {
        res.status(500).json({error: "invalid circuit or internal error"});
    }

});

const render = require("./template.js");
const circuitsTemplate = fs.readFileSync("templates/circuits.html", "utf-8"),
      circuitTemplate = fs.readFileSync("templates/individual-circuit.html", "utf-8");

app.get("/circuits", (req, res) => {
    const circuits = req.query.sort === "cells" ? getMostCellsCircuitsStmt.all() : (req.query.sort === "newest" ? getNewestCircuitsStmt.all() : getMostViewedCircuitsStmt.all());
    const html = circuits.map(circuit => render(circuitTemplate, {
        "ID": circuit.id,
        "TITLE": circuit.title,
        "VIEWS": circuit.views,
        "CELLS": circuit.cells
    })).join("");
    res.header("content-type", "text/html").send(circuitsTemplate.replace("$NUM_CIRCUITS", circuits.length).replace("$CIRCUITS", html));
});

app.get("/api/circuits/:id", (req, res) => {
    const row = getCircuitStmt.get(req.params.id);
    if(row) {
        res.json(row);
    } else {
        res.sendStatus(404);
    }
});

app.get("/api/circuits", (req, res) => res.json(getNewestCircuitsStmt.all()));

const indexTemplate = fs.readFileSync("templates/index.html", "utf-8");
app.get("/", (req, res) => {
    
    let title = "WireGame",
        description = "A game where you do stuff with wires",
        circuit = "",
        previewUrl = "";

    if(req.query.id) {
        const row = getCircuitStmt.get(req.query.id);
        if(row) {
            title = `${row.title}`;
            description = `A nifty WireGame circuit with ${row.views} views`;
            circuit = row.data;
            previewUrl = new URL(`/previews/${row.id}.png`, URL_BASE);
            incrementViewsStmt.run(req.query.id);
        }
    }

    res.header("content-type", "text/html").send(render(indexTemplate, {
        "TITLE": title,
        "DESCRIPTION": description,
        "CIRCUIT": circuit,
        "PREVIEW_URL": previewUrl || new URL("/banner.jpg", URL_BASE)
    }));

});

app.use(express.static("static"));
app.use("/previews", express.static("previews"));
app.listen(80, () => console.log("Listening!"));