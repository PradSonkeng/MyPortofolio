// base de données.js

const sqlite3 = require('sqlite3').verbose();
const dB = new sqlite3.Database('./bot.dB');
const log = require('./logger')(module);

dB.serialize(() => {
    log("Connexion à SQLite réussie.");
    dB.run(`
        CREATE TABLE IF NOT EXISTS  users (
            id TEXT PRIMARY KEY,
            name TEXT,
            firstSeen TEXT,
            commandCount INTEGER DEFAULT 0
        )
    `);
});

function getOrRegisterUser(userId, name) {
    return new Promise((resolve, reject) => {
        dB.get("SELECT * FROM users WHERE id =?", [userId], (err, row) => {
            if(err) return reject(err);
            if(row) {
                resolve(row);
            }else {
                const firstSeen = new Date().toISOString();
                dB.run("INSERT INTO users (id, name, firstSeen) VALUES (?, ?, ?)", [userId, name, firstSeen], (err) => {
                    if (err) return reject(err);
                    log(`Nouvel utilisateur enregistré : ${name} (${userId})`);
                    resolve({ id: userId, name, firstSeen, commandCount: 0 });
                });
            }
        });
    });
}

function incremComdCount(userId) {
    return new Promise((resolve, reject) => {
        dB.run("UPDATE users SET commandCount = commandCount + 1 WHERE id = ?", [userId], (err) => {
            if (err) return reject(err);
            resolve();
        });
    });
    
}

// ----LES FONCTIONS MANQUANTES SONT ICI----

function getAllUsers() {
    return new Promise((resolve,reject) => {
        dB.get("SELECT COUNT(*) as count FROM users", (err,row)=> {
            if (err) return reject(err);
            resolve(row.count || 0);
        });
    });
}
function getAllComd() {
    return new Promise((resolve, reject) => {
        dB.get("SELECT COALESCE(SUM(commandCount), 0) as total FROM users", (err, row) => {
            if (err) return reject(err);
            resolve(row.total || 0);
        });
    });
}

//--- On s'assure q'uelles sont bien exporter
module.exports = {
    getOrRegisterUser,
    incremComdCount,
    getAllUsers,
    getAllComd,
};