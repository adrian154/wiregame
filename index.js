const Database = require("better-sqlite3");
const db = new Database("data/circuits.db");

db.exec(`CREATE TABLE IF NOT EXISTS circuits (
    id INTEGER PRIMARY KEY,
    title STRING NOT NULL,
    data STRING NOT NULL,
    views INTEGER DEFAULT 0
)`);

const getCircuitStmt = db.prepare("SELECT * FROM circuits WHERE id = ?");
const addCircuitStmt = db.prepare("INSERT INTO circuits (title, data) VALUES (?, ?)")
const incrementViewsStmt = db.prepare("UPDATE circuits SET views = views + 1 WHERE id = ?");

const express = require("express");
const bodyParser = require("body-parser");
const app = express();

app.use(bodyParser.json());
app.post("/circuit", (req, res) => {
    
    const title = String(req.body.title).trim(),
          data = String(req.body.data);

    if(title.length == 0) title = "Untitled Circuit";
    if(data.match(/[^\d,;]/)) {
        return res.status(400);
    }
    
    const {lastInsertRowid} = addCircuitStmt.run(title, data);
    res.json(lastInsertRowid);

});

const template = require("fs").readFileSync("templates/index.html", "utf-8");
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

    res.header("content-type", "text/html").send(template.replaceAll("$TITLE", title).replace("$DESCRIPTION", description).replace("$CIRCUIT", circuit));

});

app.use(express.static("static"));
app.listen(80, () => console.log("Listening!"));