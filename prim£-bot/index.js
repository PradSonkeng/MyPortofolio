const expess = require('express');
const {default: makeWASocket, useMultiFileAuthState,DisconnectReason,fetchLatestBaileysVersion,jidDecode} = require ('@whiskeysockets/baileys');
const qrcode = require ("qrcode");
const pino = require ('pino');
const fs = require("fs");
const path = require ('path');
const dB = require ('./dataBase');
const { Console } = require('console');
const { type } = require('os');
const { constrainedMemory } = require('process');
const { Reaction } = require('whatsapp-web.js');
const { text } = require('stream/consumers');
const startTime = new Date();

const Auth_Folder = path.join(__dirname, "auth_info");
const Prefix = "¢";
const Bot_Name="PRIM£ BOT";
const Bot_Tag = `*${Bot_Name}* 👣`;
const Traget_Num = "237658130830";

let latestQR = null;


// ----Chargement des commandes ----
const commands = new Map();//Cree une Map pour stcker toutes les commendes 
const commandsFloder = path.join(__dirname, 'commands');//Chemin vers le dossiers
if (!fs.existsSync(commandsFloder)) fs.mkdirSync(commandsFloder);//le cree si non

function loadCommands() {
    commands.clear();
    fs.readFileSync(commandsFloder).filter(f => f.endsWith('.js'))/*ne garde que les fichiers eyant pour fin '.js'*/.forEach(file => {
        try {
            const fullPath =path.join(commandsFloder, file);
            delete require.cache[require.resolve(fullPath)];//les gardes en memoir 
            const command =require(fullPath); -//l'importe dans le prog
            commands.set(command.name,command);//Stock nom+commande dans le map
            console.log(`[CommandeLoader] ✅ Commande bien chargée :${command.name}`);
        } catch (err) {
            console.error(`[CommandeLoader] ❌ Erreur lors du chargement  ${file}:`,err);
        }
    });
}
loadCommands();

// ----fonctionts utilitaires----
function replyWithTag(sock, jid, quoted, text) {//envoie des messages à l'utilisateur
    return sock.sendMessage (jid,{text : `${Bot_Tag}\n\n${text}`} ,{quoted});
}
function gteMessageText(msg ) { //pour extraire le texte par l'utilisateur
    const m= msg.message;
    if (!m) return "";
    return m.coversation || m.extendedTextMessage?.text || m.imageMessage?.caption ||m.videoMessage?.caption || "";
}

//---Chargement Mp3 proincipal----
let mp3Buffer = null;
try {
    const mp3Path = path.join(__dirname,'fichier.mp3');
    if (fs.existsSync(mp3Path)) {
        mp3Buffer = fs.readFileSync(mp3Path);
        console.log('[Mp3] ✅ fichier.mp3 bien chargé.');
    }else {
        console.warn('[MP3] 😢 fichier.mp3 introuvable.');
    }
} catch (err){
    console.error('[MP3] ❌ Erreur de lecture du fichier.mp3:',err);
}

// ---Dénarrage du bot---
async function startBot() {
    console.log("Démarrage  du bot Whatsapp PRIM£ BOT 👣...");
    const {version} = await fetchLatestBaileysVersion();//vérifit la version
    const {state, saveCerds} = await useMultiFileAuthState(Auth_Folder);//gere et mais à jour les identifier deja enregistrer ou non
    const sock = makeWASocket ({//ouverture session Whatsapp-web
        version,
        auth: state,
        logger: pino({level:"silent"}),//desactive tout les logs internes
        printQRInTerminal: false,//le QR n'apparait pas dans leterminal mais sur un Site Web
    });

    sock.ev.on("connection.update", update =>{//Recoit les infos de connection
        const {connection,lastDisconnect,qr} = update;
        if(qr){
            latestQR = qr;
            console.log("[QR] 😬 Nouveau QR généré.Ouvrez https://localhost:3000/qr poour le sacaner.");
        }
        if (connection ==="close") {//si rupture de connection sans deconnection
            if(lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggetOut) startBot();//Redemart automatiquement
            else console.log(" 😪 Déconneté,supprime auth_info pour reconnecter manuellement");//dans le cas contraire
        } else if (connection === "open"){
            lastestQR = null;
            console.log("✅ Prim£ Bot connecté")
        }
    });

    sock.ev.on("creds.update", saveCerds);//sauvegarde automatique des nouvelles clésd'authen

    //----gestion des message----
    sock.ev.on("messages.upsert", async({messages,type}) => {
        if(type !== "notify" || !messages[0]?.message) return;//ignore les messages vide et notife
        const msg = messages[0];
        const remoteJid = msg.key.remoteJid;//identifiant de la converssation
        const senderId = msg.key.fromMe//la personne qui a envoyé le message ||moi
            ? sock.user.id.split(':')[0] + '@s.whatsapp.net'// ||contact privé
            : (remoteJid.endsWith('@g.us') ? msg.key.participant : remoteJid);// ||dans un grp

        await dB.getOrRegisterUser(senderId, msg.pushName || "Unknow");//enregistre l'utilisateur s'il n'y est pas dejà

        const text = getMessageText(msg);
        const isGroup = remoteJid.endsWith('@g.us');

        // ---Détection mention ou numéro ----
        const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.some(jid => jid.split('@')[0] === Traget_Num);
        const containsNum = text.includes(Traget_Num);
        const sendMp3 = mentioned || containsNum;

        if(isGroup && mp3Buffer && sendMp3) {
            try {
                await  sock.sendMessage(remoteJid, {audio: mp3Buffer, mimetype:'audio/mpeg', fileName: 'fichier.mp3'}, {quoted: msg});
                console.log(`[MP3] ✅ fichier.mp3 envoyé à ${senderId}`);
            } catch (err) {
                console.error("[MP3] ❌ Erreur lors de l\'envoi:", err);
            }
        }

        // ---Commande ¢downloadbot integrée---
        if(text.toLowerCase() === `${Prefix}downloadbot` ){
            const mp3Filers = ['fichier1.mp3', 'fichier2.mp2','fichier3.m3'];
            for (const file of mp3Filers) {
                const mp3Path = path.join(__dirname,file);
                if(!saveCerds.existsSync(mp3Path)){
                    await replyWithTag(sock, remoteJid, msg, `❌ Le fichier ${file} est introuvable.`);
                    continue;
                }

                try {
                    const mp3BufferVoice = fs.readFileSync(mp3Path);
                    await sock.sendMessage(remoteJid, {
                        audio: mp3BufferVoice, 
                        mimetype: 'audio/ogg; codecs=opus',
                        ptt:true,
                        fileName: file.replace('.mp3','.ogg')
                    }, {quoted: msg});
                    console.log(`[Voice] ✅ ${file} envoyé à ${remoteJid}`);
                } catch (err) {
                    console.error(`[Voice] ❌ Erreur lorsde l'envoi de ${file}:`,err);
                    await replyWithTag(sock, remoteJid, msg, `❌ une erreur est survenuie lors de l'envoi de ${file}.`);
                }
                
            }
        }

        //--- gestion des autres commandes ---
        if(!text.startWith(Prefix)) return;

        const args = text.sLice(Prefix.length).trim().split(/\s+/);
        const commandName = args.shift()?.toLowerCase();
        if(!commandName|| !commands.has(commandName)) return;

        const command = commands.get(commandName);

        try {
            if(command.adminOnly && isGroup) {
                const grpMetadata = await sock.grpMetadata(remoteJid);
                const senderIsAdmin = grpMetadata.participants.some(
                    p => p.id === senderId && (p.admin ==='admin' || p.admin ==='superadmin')
                );
                if(!senderIsAdmin) return replyWithTag(sock, remoteJid, msg ,"🛑 seul les admins peuvent utiliser cette commande.");
            }

            await command.run({sock, msg, args, replyWithTag, commands, dB});
            await dB.incrementCommandCount(senderId);
        } catch (err) {
            console.error(`[ERREUR] ❌ commande "${commandName}" : `, err);
            try {await replyWithTag(sock, remoteJid, msg, "❌  Une erreur est survenue.");} catch{}
        }
    });

    // --- exécuter get sur certaines reactions (vue unique aussi) ---
    sock.ev.on('messages.reaction', async({reactions}) => {
        try {
            if(!reactions || reactions.length === 0)return;

            const validReact = ['😎', '❤️', '😏', '🌝', '👍', '😂', '🔥', '❤️‍🔥'];

            for (const reaction of reactions) {
                if(!validReact.includes(reaction.text)) continue;

                const reactorJid = reaction.key.participant || reaction.key.remoteJid;
                const remoteJid = reaction.key.remoteJid;

                //charger le message original (plus iable que reaction.message)
                const originalMsg = await sock.loadMessage(remoteJid, reaction.key.id);
                if(!originalMsg) continue;

                const getCom = commands.get('Get');
                if(getCom) {
                    await getCom.run({
                        sock, 
                        msg: originalMsg,
                        replyWithTag: async (s, jid, _, text) => {
                            await s.sendMessage(reactorJid, {text});
                        }
                    });
                    console.log(`[REACT] ✅ Média extrait avec succès pour ${reactorJid} (réaction : ${reaction.text})`);
                }
            }
        } catch (err) {
            console.error('[REACT] ❌ Erreur lors du traitement de la réaction :', err.message);
        }
    });

}

// --- serveur web ---
const app = expess();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.send({status: "online", botName: Bot_Name, uptime: (new Date() - startTime)/1000 }));

//route HTML QR avec auto-refresh
app.get("/qr", async(req, res) =>{
    res.send(`
        <html>
            <head>
                <title>Whatsapp QR Code</title>
                <style>
                    body{display: flex ; justify-content: center; align-items: center; height: 1000vh; flex-direction: column; font-family: sans-serif;}
                    img{width: 300px; height: 300px; margin: 30px;}
                    #status{font-size: 18px; margin-top: 10px;}
                </style>
            </head>
            <body>
                <h2>Connexion ${Bot_Name}</h2>
                <img src="" id="qrImg" />
                <p id="status"></p>
                <script>
            
                    async function fetchQR() {
                        try {
                            const res= await fetch('/qr-data');
                            const data = await res.json();
                            const img = document.getElementById('qrImg');
                            const status = document.getElementById('status'); 

                            if(data.qr) {
                                img.style.display = "block";
                                img.src = data.qr;
                                status.innerText = "📲 Scannez lecode QR";
                            }else {
                                img.style.display ="none";
                                status.innerText="✅ Pirm£ Bot déjà connecté"
                            }
                        } catch (err) { console.error(err); }
                    }
                    fetchQR();
                    setInterval(fetchQR, 10000);
                </script>
            </body>
        </html>
    `);
});

// Endpoint qui renvoie le QR en Json
app.get("/qr-data", async(req, res) => {
    if(!latestQR)return res.json({qr: null});
    try {
        const qrImage = await qrcode.toDataURL(latestQR);
        res.json({qr: qrImage});
    } catch (err) {
        res.json({qr:null});
    }
});

app.listen(PORT,()=> {
    console.log(`[WebServer] 🌚 Démarré sur port ${PORT} `);
    startBot();
});
     

