const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// TES QUESTIONS DIRECTEMENT DANS LE SERVEUR (0% de chance d'erreur de connexion)
const crazyChallengeQuestions = [
  {"theme": "Sport", "question": "Combien de temps dure un match de football (sans prolongations) ?", "options": ["80 min", "90 min", "100 min", "120 min"], "answer": "90 min", "points": 10},
  {"theme": "Sport", "question": "Quel sport utilise un volant ?", "options": ["Tennis", "Badminton", "Squash", "Ping-pong"], "answer": "Badminton", "points": 10},
  {"theme": "Sport", "question": "Qui détient le record du monde du 100 mètres ?", "options": ["Carl Lewis", "Tyson Gay", "Usain Bolt", "Justin Gatlin"], "answer": "Usain Bolt", "points": 10},
  {"theme": "Sport", "question": "Combien de joueurs composent une équipe de basket-ball sur le terrain ?", "options": ["4", "5", "6", "7"], "answer": "5", "points": 10},
  {"theme": "Sport", "question": "Quel pays a remporté la Coupe du Monde de football 2022 ?", "options": ["France", "Maroc", "Brésil", "Argentine"], "answer": "Argentine", "points": 10},
  {"theme": "Sport", "question": "Sur quelle surface se joue le tournoi de Roland-Garros ?", "options": ["Gazon", "Dur", "Terre battue", "Synthétique"], "answer": "Terre battue", "points": 10},
  {"theme": "Sport", "question": "Dans quel sport trouve-t-on des mêlées et des essais ?", "options": ["Football", "Handball", "Rugby", "Volley-ball"], "answer": "Rugby", "points": 10},
  {"theme": "Sport", "question": "Quelle est la distance officielle d'un marathon ?", "options": ["21,1 km", "40 km", "42,195 km", "50 km"], "answer": "42,195 km", "points": 10},
  {"theme": "Sport", "question": "Combien d'anneaux composent le logo des Jeux Olympiques ?", "options": ["4", "5", "6", "7"], "answer": "5", "points": 10},
  {"theme": "Sport", "question": "Dans quel sport s'illustre Rafael Nadal ?", "options": ["Golf", "Tennis", "Natation", "Athlétisme"], "answer": "Tennis", "points": 10},
  {"theme": "Sport", "question": "Quel est le surnom de l'équipe de rugby de Nouvelle-Zélande ?", "options": ["Les Wallabies", "Les Springboks", "Les All Blacks", "Les Pumas"], "answer": "Les All Blacks", "points": 10},
  {"theme": "Sport", "question": "De quel pays est originaire le judo ?", "options": ["Chine", "Corée du Sud", "Japon", "Thaïlande"], "answer": "Japon", "points": 10},
  {"theme": "Sport", "question": "Combien de points vaut un lancer franc au basket-ball ?", "options": ["1 point", "2 points", "3 points", "4 points"], "answer": "1 point", "points": 10},
  {"theme": "Sport", "question": "Qui est le pilote de F1 néerlandais champion du monde en 2023 ?", "options": ["Lewis Hamilton", "Charles Leclerc", "Max Verstappen", "Fernando Alonso"], "answer": "Max Verstappen", "points": 10},
  {"theme": "Sport", "question": "Quel est le nom de la récompense donnée au meilleur joueur de football de l'année ?", "options": ["Soulier d'Or", "Ballon d'Or", "Coupe d'Or", "Gant d'Or"], "answer": "Ballon d'Or", "points": 10},
  {"theme": "Sport", "question": "Dans quel sport utilise-t-on le terme 'Hole in one' ?", "options": ["Tennis", "Baseball", "Golf", "Polo"], "answer": "Golf", "points": 10},
  {"theme": "Sport", "question": "Combien de quilles faut-il faire tomber au bowling ?", "options": ["8", "9", "10", "12"], "answer": "10", "points": 10},
  {"theme": "Sport", "question": "Dans quelle ville se trouve le stade de football 'Camp Nou' ?", "options": ["Madrid", "Barcelone", "Milan", "Londres"], "answer": "Barcelone", "points": 10},
  {"theme": "Sport", "question": "Quel art martial utilise des ceintures de couleurs pour le grade ?", "options": ["Boxe", "Karaté", "Escrime", "Lutte"], "answer": "Karaté", "points": 10},
  {"theme": "Sport", "question": "Combien de nages différentes existent en natation de compétition ?", "options": ["2", "3", "4", "5"], "answer": "4", "points": 10},

  {"theme": "Maroc", "question": "Quelle est la capitale administrative du Maroc ?", "options": ["Casablanca", "Marrakech", "Rabat", "Tanger"], "answer": "Rabat", "points": 10},
  {"theme": "Maroc", "question": "Quel est le plus haut sommet du Maroc ?", "options": ["Mont Toubkal", "Jbel Mgoun", "Oukaïmeden", "Jbel Ayachi"], "answer": "Mont Toubkal", "points": 10},
  {"theme": "Maroc", "question": "Quelle est la monnaie officielle du Maroc ?", "options": ["Le Dinar", "Le Riyal", "Le Franc", "Le Dirham"], "answer": "Le Dirham", "points": 10},
  {"theme": "Maroc", "question": "Comment appelle-t-on la ville de Chefchaouen ?", "options": ["La ville ocre", "La ville bleue", "La perle du sud", "La blanche"], "answer": "La ville bleue", "points": 10},
  {"theme": "Maroc", "question": "Quel détroit sépare le Maroc de l'Espagne ?", "options": ["Gibraltar", "Bosphore", "Béring", "Sicile"], "answer": "Gibraltar", "points": 10},
  {"theme": "Maroc", "question": "Quelle place célèbre se trouve à Marrakech ?", "options": ["Place Hassan II", "Place Jemaa el-Fna", "Place des Nations Unies", "Place Mohammed V"], "answer": "Place Jemaa el-Fna", "points": 10},
  {"theme": "Maroc", "question": "En quelle année a eu lieu la Marche Verte ?", "options": ["1956", "1965", "1975", "1980"], "answer": "1975", "points": 10},
  {"theme": "Maroc", "question": "Quelle ville marocaine est réputée pour sa mosquée géante au bord de l'eau ?", "options": ["Rabat", "Tanger", "Agadir", "Casablanca"], "answer": "Casablanca", "points": 10},
  {"theme": "Maroc", "question": "Quel est le nom de l'université historique située à Fès ?", "options": ["Al-Azhar", "Al Quaraouiyine", "Sorbonne", "Ibn Tofail"], "answer": "Al Quaraouiyine", "points": 10},
  {"theme": "Maroc", "question": "Comment s'appelle l'équipe nationale de football du Maroc ?", "options": ["Les Aigles", "Les Fennecs", "Les Lions de l'Atlas", "Les Pharaons"], "answer": "Les Lions de l'Atlas", "points": 10},
  {"theme": "Maroc", "question": "Quel explorateur célèbre est né à Tanger au 14ème siècle ?", "options": ["Ibn Battuta", "Ibn Khaldoun", "Ibn Sina", "Al Idrissi"], "answer": "Ibn Battuta", "points": 10},
  {"theme": "Maroc", "question": "Quelle est la date de la Fête de l'Indépendance du Maroc ?", "options": ["18 Novembre", "30 Juillet", "21 Août", "6 Novembre"], "answer": "18 Novembre", "points": 10},
  {"theme": "Maroc", "question": "Quel arbre endémique du Maroc donne une huile très recherchée ?", "options": ["Le Palmier", "L'Olivier", "Le Figuier", "L'Arganier"], "answer": "L'Arganier", "points": 10},
  {"theme": "Maroc", "question": "Dans quel océan se jette le fleuve Bouregreg ?", "options": ["Océan Indien", "Océan Pacifique", "Océan Atlantique", "Mer Rouge"], "answer": "Océan Atlantique", "points": 10},
  {"theme": "Maroc", "question": "Quel est l'indicatif téléphonique international du Maroc ?", "options": ["+212", "+213", "+216", "+33"], "answer": "+212", "points": 10},
  {"theme": "Maroc", "question": "Quelle ancienne cité romaine peut-on visiter près de Meknès ?", "options": ["Carthage", "Volubilis", "Pompéi", "Lixus"], "answer": "Volubilis", "points": 10},
  {"theme": "Maroc", "question": "Quel roi a fondé la ville de Marrakech ?", "options": ["Moulay Ismail", "Youssef Ibn Tachfine", "Hassan II", "Idriss Ier"], "answer": "Youssef Ibn Tachfine", "points": 10},
  {"theme": "Maroc", "question": "Quelle ville est connue comme la capitale de la poterie au Maroc ?", "options": ["Safi", "Oujda", "Tétouan", "Kénitra"], "answer": "Safi", "points": 10},
  {"theme": "Maroc", "question": "Quel est le plus long fleuve du Maroc ?", "options": ["Sebou", "Moulouya", "Oum Er-Rbia", "Tensift"], "answer": "Oum Er-Rbia", "points": 10},
  {"theme": "Maroc", "question": "Quel plat est traditionnellement consommé le vendredi au Maroc ?", "options": ["Le Tajine", "La Pastilla", "Le Couscous", "La Harira"], "answer": "Le Couscous", "points": 10},

  {"theme": "Programmation", "question": "Que signifie HTML ?", "options": ["HyperText Markup Language", "HyperLinks Text Module", "Home Tool Markup Language", "HyperTool Machine Language"], "answer": "HyperText Markup Language", "points": 10},
  {"theme": "Programmation", "question": "Quel langage est indispensable pour styliser une page web ?", "options": ["Python", "C++", "CSS", "SQL"], "answer": "CSS", "points": 10},
  {"theme": "Programmation", "question": "Quel symbole est utilisé pour l'égalité stricte en JavaScript ?", "options": ["=", "==", "===", "!="], "answer": "===", "points": 10},
  {"theme": "Programmation", "question": "Quel langage de programmation a pour logo un serpent ?", "options": ["Ruby", "Java", "Swift", "Python"], "answer": "Python", "points": 10},
  {"theme": "Programmation", "question": "Comment déclare-t-on une constante en JavaScript ?", "options": ["let", "var", "const", "static"], "answer": "const", "points": 10},
  {"theme": "Programmation", "question": "Que signifie l'acronyme API ?", "options": ["Advanced Program Integration", "Application Programming Interface", "Auto Process Internet", "Applied Protocol Interface"], "answer": "Application Programming Interface", "points": 10},
  {"theme": "Programmation", "question": "Quel est le gestionnaire de paquets par défaut de Node.js ?", "options": ["pip", "gem", "npm", "composer"], "answer": "npm", "points": 10},
  {"theme": "Programmation", "question": "Quel langage est principalement utilisé pour interroger des bases de données relationnelles ?", "options": ["Java", "SQL", "C#", "HTML"], "answer": "SQL", "points": 10},
  {"theme": "Programmation", "question": "Dans un tableau JavaScript, quel est le premier index ?", "options": ["1", "-1", "0", "A"], "answer": "0", "points": 10},
  {"theme": "Programmation", "question": "Quel outil est le plus utilisé pour le contrôle de version du code ?", "options": ["Docker", "Git", "Jenkins", "Kubernetes"], "answer": "Git", "points": 10},
  {"theme": "Programmation", "question": "Quel mot-clé JavaScript permet d'intercepter une erreur ?", "options": ["catch", "error", "throw", "stop"], "answer": "catch", "points": 10},
  {"theme": "Programmation", "question": "Qu'est-ce qu'un booléen ?", "options": ["Un nombre décimal", "Une chaîne de caractères", "Une valeur Vrai ou Faux", "Une fonction"], "answer": "Une valeur Vrai ou Faux", "points": 10},
  {"theme": "Programmation", "question": "Quel code HTTP indique 'Page non trouvée' ?", "options": ["200", "301", "404", "500"], "answer": "404", "points": 10},
  {"theme": "Programmation", "question": "Comment s'appelle une boucle qui ne s'arrête jamais ?", "options": ["Boucle for", "Boucle infinie", "Boucle aveugle", "Boucle morte"], "answer": "Boucle infinie", "points": 10},
  {"theme": "Programmation", "question": "Qui est le créateur du langage JavaScript ?", "options": ["Bill Gates", "Mark Zuckerberg", "Brendan Eich", "Linus Torvalds"], "answer": "Brendan Eich", "points": 10},
  {"theme": "Programmation", "question": "Quel framework JavaScript est développé par Facebook ?", "options": ["Angular", "Vue", "Svelte", "React"], "answer": "React", "points": 10},
  {"theme": "Programmation", "question": "Quel format est le plus utilisé pour l'échange de données web ?", "options": ["XML", "JSON", "CSV", "TXT"], "answer": "JSON", "points": 10},
  {"theme": "Programmation", "question": "Qu'est-ce que le 'backend' ?", "options": ["L'interface utilisateur", "Le serveur et la base de données", "Le design du site", "Le navigateur web"], "answer": "Le serveur et la base de données", "points": 10},
  {"theme": "Programmation", "question": "Quel code hexadécimal représente la couleur noire en CSS ?", "options": ["#FFFFFF", "#000000", "#FF0000", "#00FF00"], "answer": "#000000", "points": 10},
  {"theme": "Programmation", "question": "Quelle méthode JavaScript ajoute un élément à la fin d'un tableau ?", "options": ["push()", "pop()", "shift()", "unshift()"], "answer": "push()", "points": 10},

  {"theme": "Animaux", "question": "Quel est l'animal terrestre le plus rapide ?", "options": ["Le lion", "L'autruche", "Le guépard", "Le cheval"], "answer": "Le guépard", "points": 10},
  {"theme": "Animaux", "question": "Quel est le plus grand mammifère du monde ?", "options": ["L'éléphant d'Afrique", "La baleine bleue", "Le requin baleine", "Le cachalot"], "answer": "La baleine bleue", "points": 10},
  {"theme": "Animaux", "question": "Combien de pattes possède une araignée ?", "options": ["6", "8", "10", "12"], "answer": "8", "points": 10},
  {"theme": "Animaux", "question": "Quel animal est connu pour sa capacité à changer de couleur ?", "options": ["L'iguane", "Le serpent", "Le caméléon", "La salamandre"], "answer": "Le caméléon", "points": 10},
  {"theme": "Animaux", "question": "Quel est le seul mammifère capable de voler ?", "options": ["L'écureuil volant", "La chauve-souris", "L'ornithorynque", "Le casoar"], "answer": "La chauve-souris", "points": 10},
  {"theme": "Animaux", "question": "Comment s'appelle la femelle du sanglier ?", "options": ["La laie", "La truie", "La louve", "La hure"], "answer": "La laie", "points": 10},
  {"theme": "Animaux", "question": "Combien de cœurs possède une pieuvre ?", "options": ["1", "2", "3", "4"], "answer": "3", "points": 10},
  {"theme": "Animaux", "question": "Quel animal est le symbole de la paix ?", "options": ["Le cygne", "La colombe", "L'aigle", "Le moineau"], "answer": "La colombe", "points": 10},
  {"theme": "Animaux", "question": "Quel oiseau pond les plus gros œufs ?", "options": ["L'émeu", "Le condor", "L'autruche", "Le casoar"], "answer": "L'autruche", "points": 10},
  {"theme": "Animaux", "question": "Quel mammifère marin est réputé pour sa grande intelligence ?", "options": ["Le requin", "Le dauphin", "La raie", "Le phoque"], "answer": "Le dauphin", "points": 10},
  {"theme": "Animaux", "question": "De quoi se nourrit principalement le panda géant ?", "options": ["De viande", "De poissons", "De bambou", "De fruits"], "answer": "De bambou", "points": 10},
  {"theme": "Animaux", "question": "Quel animal est considéré comme le roi de la jungle ?", "options": ["Le tigre", "L'éléphant", "Le gorille", "Le lion"], "answer": "Le lion", "points": 10},
  {"theme": "Animaux", "question": "Où vivent naturellement les ours polaires ?", "options": ["En Antarctique", "En Arctique", "En Patagonie", "Dans les Andes"], "answer": "En Arctique", "points": 10},
  {"theme": "Animaux", "question": "Quel insecte fabrique du miel ?", "options": ["La guêpe", "Le frelon", "L'abeille", "La fourmi"], "answer": "L'abeille", "points": 10},
  {"theme": "Animaux", "question": "Quel reptile porte sa maison sur son dos ?", "options": ["Le crocodile", "Le serpent", "L'iguane", "La tortue"], "answer": "La tortue", "points": 10},
  {"theme": "Animaux", "question": "Comment appelle-t-on un bébé mouton ?", "options": ["L'agneau", "Le chevreau", "Le poulain", "Le porcelet"], "answer": "L'agneau", "points": 10},
  {"theme": "Animaux", "question": "Quel animal a une corne sur le nez ?", "options": ["L'hippopotame", "Le rhinocéros", "L'élan", "Le morse"], "answer": "Le rhinocéros", "points": 10},
  {"theme": "Animaux", "question": "Quel est l'oiseau qui ne vole pas mais nage très bien ?", "options": ["Le pélican", "Le pingouin", "Le cormoran", "Le macareux"], "answer": "Le pingouin", "points": 10},
  {"theme": "Animaux", "question": "Comment s'appelle un groupe de loups ?", "options": ["Un troupeau", "Une harde", "Une meute", "Un essaim"], "answer": "Une meute", "points": 10},
  {"theme": "Animaux", "question": "Quel est l'animal terrestre le plus lourd ?", "options": ["La girafe", "L'éléphant d'Afrique", "L'ours brun", "L'hippopotame"], "answer": "L'éléphant d'Afrique", "points": 10}
];

const activeGames = {};

io.on('connection', (socket) => {
    
    socket.on('admin_create_game', () => {
        const pin = Math.floor(1000 + Math.random() * 9000).toString();
        activeGames[pin] = {
            admin: socket.id,
            players: {},
            lockedPlayers: [],
            status: 'lobby',
            currentTheme: 'Programmation',
            nextTheme: 'Programmation',
            buzzedPlayerId: null
        };
        socket.join(pin);
        socket.emit('game_created', { pin });
    });

    socket.on('join_game', (data) => {
        const { pin, name, role } = data;
        if (activeGames[pin]) {
            socket.join(pin);
            socket.gamePin = pin;
            socket.role = role;

            if (role === 'player') {
                activeGames[pin].players[socket.id] = { name, score: 0 };
                io.to(activeGames[pin].admin).emit('update_players', activeGames[pin].players);
            }
            socket.emit('join_success', { role });
        }
    });

    socket.on('change_theme', (data) => {
        const { pin, theme } = data;
        if (activeGames[pin]) {
            activeGames[pin].nextTheme = theme;
            io.to(pin).emit('theme_notification', theme);
        }
    });

    socket.on('admin_action_next', (data) => {
        const { pin } = data;
        const game = activeGames[pin];
        if (!game) return;

        game.currentTheme = game.nextTheme;
        game.lockedPlayers = [];
        game.buzzedPlayerId = null;

        // 1. Filtrer les questions par le thème choisi
        const themeQuestions = crazyChallengeQuestions.filter(q => q.theme === game.currentTheme);

        if (themeQuestions.length > 0) {
            // 2. Choisir une question au hasard
            const randomQ = themeQuestions[Math.floor(Math.random() * themeQuestions.length)];
            
            // 3. Formater les données pour correspondre exactement à ce qu'attend le HTML
            const letters = ['A', 'B', 'C', 'D'];
            const correctIndex = randomQ.options.indexOf(randomQ.answer);
            const correctLetter = letters[correctIndex];

            const formattedQ = {
                question_text: randomQ.question,
                choice_a: randomQ.options[0],
                choice_b: randomQ.options[1],
                choice_c: randomQ.options[2],
                choice_d: randomQ.options[3],
                correct_answer: correctLetter
            };

            game.status = 'reading';

            // Envoi à l'admin (avec la réponse)
            io.to(game.admin).emit('admin_display_question', formattedQ);
            
            // Envoi aux joueurs et spectateurs (sans la réponse)
            const safeQ = { 
                question_text: formattedQ.question_text, 
                choice_a: formattedQ.choice_a, 
                choice_b: formattedQ.choice_b, 
                choice_c: formattedQ.choice_c, 
                choice_d: formattedQ.choice_d 
            };
            io.to(pin).emit('display_question', safeQ);

            setTimeout(() => { if (activeGames[pin]) activeGames[pin].status = 'waiting_for_buzz'; }, 4000);
        } else {
             io.to(game.admin).emit('admin_error', `Aucune question trouvée pour le thème : ${game.currentTheme}`);
        }
    });

    socket.on('buzz', () => {
        const pin = socket.gamePin;
        const game = activeGames[pin];
        if (!game || game.status !== 'waiting_for_buzz' || game.lockedPlayers.includes(socket.id)) return;

        game.status = 'answering';
        game.buzzedPlayerId = socket.id;
        
        io.to(pin).emit('buzzer_hit', { winnerId: socket.id, name: game.players[socket.id].name }); 
    });

    socket.on('submit_answer', (answer) => {
        const pin = socket.gamePin;
        const game = activeGames[pin];
        if (!game || game.status !== 'answering' || game.buzzedPlayerId !== socket.id) return;
        
        io.to(game.admin).emit('player_answered', { name: game.players[socket.id].name, answer });
        io.to(pin).emit('spectator_answer_locked', { name: game.players[socket.id].name, answer });
    });

    socket.on('admin_validate', (data) => {
        const { pin, isCorrect } = data;
        const game = activeGames[pin];
        const pId = game.buzzedPlayerId;
        
        // Sécurité si le joueur a quitté
        if(!pId || !game.players[pId]) return;

        const pName = game.players[pId].name;

        if (isCorrect) {
            game.players[pId].score += 1;
            if (game.players[pId].score >= 10) {
                io.to(pin).emit('game_over', { name: pName, score: game.players[pId].score });
                game.status = 'finished';
            } else {
                io.to(pin).emit('answer_correct', { name: pName, score: game.players[pId].score });
                game.status = 'lobby';
            }
            io.to(game.admin).emit('update_players', game.players);
        } else {
            game.players[pId].score -= 1;
            game.lockedPlayers.push(pId);
            io.to(pin).emit('answer_wrong', { name: pName, score: game.players[pId].score, lockedId: pId });
            io.to(game.admin).emit('update_players', game.players);
            
            game.status = 'waiting_for_buzz';
            game.buzzedPlayerId = null;
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));