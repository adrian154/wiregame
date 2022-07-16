const Database = require("better-sqlite3");
const db = new Database("data/circuits.db");
const fs = require("fs");

db.exec(`CREATE TABLE IF NOT EXISTS circuits (
    id INTEGER PRIMARY KEY,
    title STRING NOT NULL,
    data STRING NOT NULL,
    views INTEGER DEFAULT 0,
    cells INTEGER NOT NULL
)`);

const getCircuitStmt = db.prepare("SELECT * FROM circuits WHERE id = ?");
const addCircuitStmt = db.prepare("INSERT INTO circuits (title, data, cells) VALUES (?, ?, ?)")
const incrementViewsStmt = db.prepare("UPDATE circuits SET views = views + 1 WHERE id = ?");
const getCircuitsStmt = db.prepare("SELECT id, title, views, cells FROM circuits ORDER BY views DESC");

const express = require("express");
const bodyParser = require("body-parser");
const app = express();

app.use(bodyParser.json());
app.post("/circuit", (req, res) => {
    
    let title = String(req.body.title).trim(),
          data = String(req.body.data);

    if(title.length == 0) title = "Untitled Circuit";
    if(data.match(/[^-\d,;]/)) {
        return res.sendStatus(400);
    }

    const numCells = data.split(';').length;
    
    const {lastInsertRowid} = addCircuitStmt.run(title, data, numCells);
    res.json(lastInsertRowid);

});

const circuitsTemplate = fs.readFileSync("templates/circuits.html", "utf-8"),
      circuitTemplate = fs.readFileSync("templates/individual-circuit.html", "utf-8");

const sanitize = str => str.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

app.get("/circuits", (req, res) => {
    const circuits = getCircuitsStmt.all();
    const html = circuits.map(circuit => circuitTemplate.replace("$ID", circuit.id).replace("$TITLE", sanitize(circuit.title)).replace("$VIEWS", circuit.views).replace("$CELLS", circuit.cells)).join("");
    res.header("content-type", "text/html").send(circuitsTemplate.replace("$NUM_CIRCUITS", circuits.length).replace("$CIRCUITS", html));
});

const indexTemplate = fs.readFileSync("templates/index.html", "utf-8");
app.get("/", (req, res) => {
    
    let title = "WireGame",
        description = "A game where you do stuff with wires",
        circuit = "";

    if(req.query.id) {
        const row = getCircuitStmt.get(req.query.id);
        if(row) {
            title = `${row.title}`;
            description = `A nifty WireGame circuit with ${row.views} views`;
            circuit = row.data;
            incrementViewsStmt.run(req.query.id);
        }
    }

    res.header("content-type", "text/html").send(indexTemplate.replaceAll("$TITLE", title).replace("$DESCRIPTION", description).replace("$CIRCUIT", circuit));

});

app.use(express.static("static"));
app.listen(80, () => console.log("Listening!"));