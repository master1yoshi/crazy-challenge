require('dotenv').config();
const { Pool } = require('pg');

// Connexion à ta base de données Neon
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Ton tableau de questions
const crazyChallengeQuestions = [
    // --- SPORT ---
    { theme: "Sport", question: "Combien de temps dure un match de football (sans prolongations) ?", options: ["80 min", "90 min", "100 min", "120 min"], answer: "90 min" },
    { theme: "Sport", question: "Quel sport utilise un volant ?", options: ["Tennis", "Badminton", "Squash", "Ping-pong"], answer: "Badminton" },
    { theme: "Sport", question: "Qui détient le record du monde du 100 mètres ?", options: ["Carl Lewis", "Tyson Gay", "Usain Bolt", "Justin Gatlin"], answer: "Usain Bolt" },
    { theme: "Sport", question: "Combien de joueurs composent une équipe de basket-ball sur le terrain ?", options: ["4", "5", "6", "7"], answer: "5" },
    { theme: "Sport", question: "Quel pays a remporté la Coupe du Monde de football 2022 ?", options: ["France", "Maroc", "Brésil", "Argentine"], answer: "Argentine" },
    { theme: "Sport", question: "Sur quelle surface se joue le tournoi de Roland-Garros ?", options: ["Gazon", "Dur", "Terre battue", "Synthétique"], answer: "Terre battue" },
    { theme: "Sport", question: "Dans quel sport trouve-t-on des mêlées et des essais ?", options: ["Football", "Handball", "Rugby", "Volley-ball"], answer: "Rugby" },
    { theme: "Sport", question: "Quelle est la distance officielle d'un marathon ?", options: ["21,1 km", "40 km", "42,195 km", "50 km"], answer: "42,195 km" },
    { theme: "Sport", question: "Combien d'anneaux composent le logo des Jeux Olympiques ?", options: ["4", "5", "6", "7"], answer: "5" },
    { theme: "Sport", question: "Dans quel sport s'illustre Rafael Nadal ?", options: ["Golf", "Tennis", "Natation", "Athlétisme"], answer: "Tennis" },
    { theme: "Sport", question: "Quel est le surnom de l'équipe de rugby de Nouvelle-Zélande ?", options: ["Les Wallabies", "Les Springboks", "Les All Blacks", "Les Pumas"], answer: "Les All Blacks" },
    { theme: "Sport", question: "De quel pays est originaire le judo ?", options: ["Chine", "Corée du Sud", "Japon", "Thaïlande"], answer: "Japon" },
    { theme: "Sport", question: "Combien de points vaut un lancer franc au basket-ball ?", options: ["1 point", "2 points", "3 points", "4 points"], answer: "1 point" },
    { theme: "Sport", question: "Qui est le pilote de F1 néerlandais champion du monde en 2023 ?", options: ["Lewis Hamilton", "Charles Leclerc", "Max Verstappen", "Fernando Alonso"], answer: "Max Verstappen" },
    { theme: "Sport", question: "Quel est le nom de la récompense donnée au meilleur joueur de football de l'année ?", options: ["Soulier d'Or", "Ballon d'Or", "Coupe d'Or", "Gant d'Or"], answer: "Ballon d'Or" },
    { theme: "Sport", question: "Dans quel sport utilise-t-on le terme 'Hole in one' ?", options: ["Tennis", "Baseball", "Golf", "Polo"], answer: "Golf" },
    { theme: "Sport", question: "Combien de quilles faut-il faire tomber au bowling ?", options: ["8", "9", "10", "12"], answer: "10" },
    { theme: "Sport", question: "Dans quelle ville se trouve le stade de football 'Camp Nou' ?", options: ["Madrid", "Barcelone", "Milan", "Londres"], answer: "Barcelone" },
    { theme: "Sport", question: "Quel art martial utilise des ceintures de couleurs pour le grade ?", options: ["Boxe", "Karaté", "Escrime", "Lutte"], answer: "Karaté" },
    { theme: "Sport", question: "Combien de nages différentes existent en natation de compétition ?", options: ["2", "3", "4", "5"], answer: "4" },

    // --- MAROC ---
    { theme: "Maroc", question: "Quelle est la capitale administrative du Maroc ?", options: ["Casablanca", "Marrakech", "Rabat", "Tanger"], answer: "Rabat" },
    { theme: "Maroc", question: "Quel est le plus haut sommet du Maroc ?", options: ["Mont Toubkal", "Jbel Mgoun", "Oukaïmeden", "Jbel Ayachi"], answer: "Mont Toubkal" },
    { theme: "Maroc", question: "Quelle est la monnaie officielle du Maroc ?", options: ["Le Dinar", "Le Riyal", "Le Franc", "Le Dirham"], answer: "Le Dirham" },
    { theme: "Maroc", question: "Comment appelle-t-on la ville de Chefchaouen ?", options: ["La ville ocre", "La ville bleue", "La perle du sud", "La blanche"], answer: "La ville bleue" },
    { theme: "Maroc", question: "Quel détroit sépare le Maroc de l'Espagne ?", options: ["Gibraltar", "Bosphore", "Béring", "Sicile"], answer: "Gibraltar" },
    { theme: "Maroc", question: "Quelle place célèbre se trouve à Marrakech ?", options: ["Place Hassan II", "Place Jemaa el-Fna", "Place des Nations Unies", "Place Mohammed V"], answer: "Place Jemaa el-Fna" },
    { theme: "Maroc", question: "En quelle année a eu lieu la Marche Verte ?", options: ["1956", "1965", "1975", "1980"], answer: "1975" },
    { theme: "Maroc", question: "Quelle ville marocaine est réputée pour sa mosquée géante au bord de l'eau ?", options: ["Rabat", "Tanger", "Agadir", "Casablanca"], answer: "Casablanca" },
    { theme: "Maroc", question: "Quel est le nom de l'université historique située à Fès ?", options: ["Al-Azhar", "Al Quaraouiyine", "Sorbonne", "Ibn Tofail"], answer: "Al Quaraouiyine" },
    { theme: "Maroc", question: "Comment s'appelle l'équipe nationale de football du Maroc ?", options: ["Les Aigles", "Les Fennecs", "Les Lions de l'Atlas", "Les Pharaons"], answer: "Les Lions de l'Atlas" },
    { theme: "Maroc", question: "Quel explorateur célèbre est né à Tanger au 14ème siècle ?", options: ["Ibn Battuta", "Ibn Khaldoun", "Ibn Sina", "Al Idrissi"], answer: "Ibn Battuta" },
    { theme: "Maroc", question: "Quelle est la date de la Fête de l'Indépendance du Maroc ?", options: ["18 Novembre", "30 Juillet", "21 Août", "6 Novembre"], answer: "18 Novembre" },
    { theme: "Maroc", question: "Quel arbre endémique du Maroc donne une huile très recherchée ?", options: ["Le Palmier", "L'Olivier", "Le Figuier", "L'Arganier"], answer: "L'Arganier" },
    { theme: "Maroc", question: "Dans quel océan se jette le fleuve Bouregreg ?", options: ["Océan Indien", "Océan Pacifique", "Océan Atlantique", "Mer Rouge"], answer: "Océan Atlantique" },
    { theme: "Maroc", question: "Quel est l'indicatif téléphonique international du Maroc ?", options: ["+212", "+213", "+216", "+33"], answer: "+212" },
    { theme: "Maroc", question: "Quelle ancienne cité romaine peut-on visiter près de Meknès ?", options: ["Carthage", "Volubilis", "Pompéi", "Lixus"], answer: "Volubilis" },
    { theme: "Maroc", question: "Quel roi a fondé la ville de Marrakech ?", options: ["Moulay Ismail", "Youssef Ibn Tachfine", "Hassan II", "Idriss Ier"], answer: "Youssef Ibn Tachfine" },
    { theme: "Maroc", question: "Quelle ville est connue comme la capitale de la poterie au Maroc ?", options: ["Safi", "Oujda", "Tétouan", "Kénitra"], answer: "Safi" },
    { theme: "Maroc", question: "Quel est le plus long fleuve du Maroc ?", options: ["Sebou", "Moulouya", "Oum Er-Rbia", "Tensift"], answer: "Oum Er-Rbia" },
    { theme: "Maroc", question: "Quel plat est traditionnellement consommé le vendredi au Maroc ?", options: ["Le Tajine", "La Pastilla", "Le Couscous", "La Harira"], answer: "Le Couscous" },

    // --- PROGRAMMATION ---
    { theme: "Programmation", question: "Que signifie HTML ?", options: ["HyperText Markup Language", "HyperLinks Text Module", "Home Tool Markup Language", "HyperTool Machine Language"], answer: "HyperText Markup Language" },
    { theme: "Programmation", question: "Quel langage est indispensable pour styliser une page web ?", options: ["Python", "C++", "CSS", "SQL"], answer: "CSS" },
    { theme: "Programmation", question: "Quel symbole est utilisé pour l'égalité stricte en JavaScript ?", options: ["=", "==", "===", "!="], answer: "===" },
    { theme: "Programmation", question: "Quel langage de programmation a pour logo un serpent ?", options: ["Ruby", "Java", "Swift", "Python"], answer: "Python" },
    { theme: "Programmation", question: "Comment déclare-t-on une constante en JavaScript ?", options: ["let", "var", "const", "static"], answer: "const" },
    { theme: "Programmation", question: "Que signifie l'acronyme API ?", options: ["Advanced Program Integration", "Application Programming Interface", "Auto Process Internet", "Applied Protocol Interface"], answer: "Application Programming Interface" },
    { theme: "Programmation", question: "Quel est le gestionnaire de paquets par défaut de Node.js ?", options: ["pip", "gem", "npm", "composer"], answer: "npm" },
    { theme: "Programmation", question: "Quel langage est principalement utilisé pour interroger des bases de données relationnelles ?", options: ["Java", "SQL", "C#", "HTML"], answer: "SQL" },
    { theme: "Programmation", question: "Dans un tableau JavaScript, quel est le premier index ?", options: ["1", "-1", "0", "A"], answer: "0" },
    { theme: "Programmation", question: "Quel outil est le plus utilisé pour le contrôle de version du code ?", options: ["Docker", "Git", "Jenkins", "Kubernetes"], answer: "Git" },
    { theme: "Programmation", question: "Quel mot-clé JavaScript permet d'intercepter une erreur ?", options: ["catch", "error", "throw", "stop"], answer: "catch" },
    { theme: "Programmation", question: "Qu'est-ce qu'un booléen ?", options: ["Un nombre décimal", "Une chaîne de caractères", "Une valeur Vrai ou Faux", "Une fonction"], answer: "Une valeur Vrai ou Faux" },
    { theme: "Programmation", question: "Quel code HTTP indique 'Page non trouvée' ?", options: ["200", "301", "404", "500"], answer: "404" },
    { theme: "Programmation", question: "Comment s'appelle une boucle qui ne s'arrête jamais ?", options: ["Boucle for", "Boucle infinie", "Boucle aveugle", "Boucle morte"], answer: "Boucle infinie" },
    { theme: "Programmation", question: "Qui est le créateur du langage JavaScript ?", options: ["Bill Gates", "Mark Zuckerberg", "Brendan Eich", "Linus Torvalds"], answer: "Brendan Eich" },
    { theme: "Programmation", question: "Quel framework JavaScript est développé par Facebook (Meta) ?", options: ["Angular", "Vue", "Svelte", "React"], answer: "React" },
    { theme: "Programmation", question: "Quel format est le plus utilisé pour l'échange de données web ?", options: ["XML", "JSON", "CSV", "TXT"], answer: "JSON" },
    { theme: "Programmation", question: "Qu'est-ce que le 'backend' ?", options: ["L'interface utilisateur", "Le serveur et la base de données", "Le design du site", "Le navigateur web"], answer: "Le serveur et la base de données" },
    { theme: "Programmation", question: "Quel code hexadécimal représente la couleur noire en CSS ?", options: ["#FFFFFF", "#000000", "#FF0000", "#00FF00"], answer: "#000000" },
    { theme: "Programmation", question: "Quelle méthode JavaScript ajoute un élément à la fin d'un tableau ?", options: ["push()", "pop()", "shift()", "unshift()"], answer: "push()" },

    // --- ANIMAUX ---
    { theme: "Animaux", question: "Quel est l'animal terrestre le plus rapide ?", options: ["Le lion", "L'autruche", "Le guépard", "Le cheval"], answer: "Le guépard" },
    { theme: "Animaux", question: "Quel est le plus grand mammifère du monde ?", options: ["L'éléphant d'Afrique", "La baleine bleue", "Le requin baleine", "Le cachalot"], answer: "La baleine bleue" },
    { theme: "Animaux", question: "Combien de pattes possède une araignée ?", options: ["6", "8", "10", "12"], answer: "8" },
    { theme: "Animaux", question: "Quel animal est connu pour sa capacité à changer de couleur ?", options: ["L'iguane", "Le serpent", "Le caméléon", "La salamandre"], answer: "Le caméléon" },
    { theme: "Animaux", question: "Quel est le seul mammifère capable de voler ?", options: ["L'écureuil volant", "La chauve-souris", "L'ornithorynque", "Le casoar"], answer: "La chauve-souris" },
    { theme: "Animaux", question: "Comment s'appelle la femelle du sanglier ?", options: ["La laie", "La truie", "La louve", "La hure"], answer: "La laie" },
    { theme: "Animaux", question: "Combien de cœurs possède une pieuvre ?", options: ["1", "2", "3", "4"], answer: "3" },
    { theme: "Animaux", question: "Quel animal est le symbole de la paix ?", options: ["Le cygne", "La colombe", "L'aigle", "Le moineau"], answer: "La colombe" },
    { theme: "Animaux", question: "Quel oiseau pond les plus gros œufs ?", options: ["L'émeu", "Le condor", "L'autruche", "Le casoar"], answer: "L'autruche" },
    { theme: "Animaux", question: "Quel mammifère marin est réputé pour sa grande intelligence ?", options: ["Le requin", "Le dauphin", "La raie", "Le phoque"], answer: "Le dauphin" },
    { theme: "Animaux", question: "De quoi se nourrit principalement le panda géant ?", options: ["De viande", "De poissons", "De bambou", "De fruits"], answer: "De bambou" },
    { theme: "Animaux", question: "Quel animal est considéré comme le roi de la jungle ?", options: ["Le tigre", "L'éléphant", "Le gorille", "Le lion"], answer: "Le lion" },
    { theme: "Animaux", question: "Où vivent naturellement les ours polaires ?", options: ["En Antarctique", "En Arctique", "En Patagonie", "Dans les Andes"], answer: "En Arctique" },
    { theme: "Animaux", question: "Quel insecte fabrique du miel ?", options: ["La guêpe", "Le frelon", "L'abeille", "La fourmi"], answer: "L'abeille" },
    { theme: "Animaux", question: "Quel reptile porte sa maison sur son dos ?", options: ["Le crocodile", "Le serpent", "L'iguane", "La tortue"], answer: "La tortue" },
    { theme: "Animaux", question: "Comment appelle-t-on un bébé mouton ?", options: ["L'agneau", "Le chevreau", "Le poulain", "Le porcelet"], answer: "L'agneau" },
    { theme: "Animaux", question: "Quel animal a une corne sur le nez ?", options: ["L'hippopotame", "Le rhinocéros", "L'élan", "Le morse"], answer: "Le rhinocéros" },
    { theme: "Animaux", question: "Quel est l'oiseau qui ne vole pas mais nage très bien ?", options: ["Le pélican", "Le pingouin / manchot", "Le cormoran", "Le macareux"], answer: "Le pingouin / manchot" },
    { theme: "Animaux", question: "Comment s'appelle un groupe de loups ?", options: ["Un troupeau", "Une harde", "Une meute", "Un essaim"], answer: "Une meute" },
    { theme: "Animaux", question: "Quel est l'animal le plus grand vivant sur terre (hors océan) ?", options: ["La girafe", "L'éléphant d'Afrique", "L'ours brun", "L'hippopotame"], answer: "L'éléphant d'Afrique" }
];

async function insertData() {
    console.log("Suppression des anciennes questions...");
    await pool.query('DELETE FROM questions');

    console.log("Insertion des 80 nouvelles questions...");
    for (let q of crazyChallengeQuestions) {
        // Trouver l'index de la bonne réponse (0=A, 1=B, 2=C, 3=D)
        const correctIndex = q.options.indexOf(q.answer);
        const letters = ['A', 'B', 'C', 'D'];
        const correctLetter = letters[correctIndex];

        await pool.query(
            `INSERT INTO questions (theme, question_text, choice_a, choice_b, choice_c, choice_d, correct_answer) 
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [q.theme, q.question, q.options[0], q.options[1], q.options[2], q.options[3], correctLetter]
        );
    }
    
    console.log("✅ Base de données mise à jour avec succès !");
    process.exit(); // Ferme le script
}

insertData().catch(err => console.error("Erreur lors de l'insertion :", err));