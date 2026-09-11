const general = [
  ['Wie viele Kontinente gibt es?', ['5','6','7','8'], 2],
  ['Welche Farbe entsteht aus Blau und Gelb?', ['Grün','Orange','Lila','Rot'], 0],
  ['Wie viele Sekunden hat eine Minute?', ['30','45','60','90'], 2],
  ['Welcher Planet ist der Sonne am nächsten?', ['Venus','Merkur','Mars','Erde'], 1],
  ['Wie viele Seiten hat ein Hexagon?', ['5','6','7','8'], 1],
  ['Was ist die Hauptstadt von Frankreich?', ['Rom','Paris','Madrid','Wien'], 1],
  ['Welches Tier gilt als größtes Landsäugetier?', ['Giraffe','Elefant','Nashorn','Nilpferd'], 1],
  ['Wie viele Tage hat ein Schaltjahr?', ['365','366','364','367'], 1],
  ['Welches Element hat das Symbol O?', ['Gold','Sauerstoff','Osmium','Silber'], 1],
  ['Wie viele Spieler stehen pro Fußballteam regulär auf dem Feld?', ['9','10','11','12'], 2],
  ['Welche Sprache wird in Brasilien hauptsächlich gesprochen?', ['Spanisch','Portugiesisch','Französisch','Englisch'], 1],
  ['Wie heißt der größte Ozean?', ['Atlantik','Indischer Ozean','Pazifik','Arktischer Ozean'], 2],
  ['Wie viele Monate haben 31 Tage?', ['5','6','7','8'], 2],
  ['Welches Instrument hat typischerweise 88 Tasten?', ['Klavier','Gitarre','Violine','Trompete'], 0],
  ['Welche Form hat drei Seiten?', ['Quadrat','Dreieck','Kreis','Fünfeck'], 1],
  ['Was ist H2O?', ['Salz','Wasser','Sauerstoff','Wasserstoff'], 1],
  ['Wie viele Stunden hat ein Tag?', ['12','18','24','36'], 2],
  ['Welcher Planet ist für seine Ringe bekannt?', ['Mars','Saturn','Merkur','Venus'], 1],
  ['Welche Zahl ist eine Primzahl?', ['9','15','17','21'], 2],
  ['Wie viele Zentimeter sind ein Meter?', ['10','50','100','1000'], 2],
  ['Was ist die Hauptstadt von Italien?', ['Mailand','Rom','Neapel','Turin'], 1],
  ['Welches Tier legt Eier?', ['Delfin','Hund','Huhn','Katze'], 2],
  ['Wie viele Ecken hat ein Würfel?', ['6','8','10','12'], 1],
  ['Was misst ein Thermometer?', ['Geschwindigkeit','Temperatur','Druck','Entfernung'], 1],
  ['Welche Jahreszeit folgt auf den Sommer?', ['Frühling','Winter','Herbst','Sommer'], 2],
  ['Wie viele Minuten hat eine Stunde?', ['30','45','60','90'], 2],
  ['Welches Metall ist bei Raumtemperatur flüssig?', ['Eisen','Quecksilber','Kupfer','Aluminium'], 1],
  ['Was ist die Hauptstadt von Spanien?', ['Barcelona','Madrid','Valencia','Sevilla'], 1],
  ['Wie viele Nullen hat eine Million?', ['4','5','6','7'], 2],
  ['Welcher Kontinent ist flächenmäßig der größte?', ['Europa','Afrika','Asien','Südamerika'], 2],
  ['Welche Einheit misst elektrische Spannung?', ['Volt','Watt','Ampere','Ohm'], 0],
  ['Wie viele Beine hat eine Spinne?', ['6','8','10','12'], 1],
  ['Welches Organ pumpt Blut durch den Körper?', ['Lunge','Leber','Herz','Niere'], 2],
  ['Welche Zahl entspricht der römischen Zahl X?', ['5','10','50','100'], 1],
  ['Wie heißt unser Stern?', ['Sirius','Sonne','Polaris','Vega'], 1],
  ['Welches Gas nehmen Pflanzen hauptsächlich aus der Luft auf?', ['Sauerstoff','Stickstoff','Kohlendioxid','Helium'], 2],
  ['Was ist die Hauptstadt von Österreich?', ['Graz','Salzburg','Wien','Linz'], 2],
  ['Wie viele Farben hat ein klassischer Regenbogen?', ['5','6','7','8'], 2],
  ['Welche Zahl ist gerade?', ['13','17','22','29'], 2],
  ['Welches Meer liegt zwischen Europa und Afrika?', ['Nordsee','Mittelmeer','Ostsee','Schwarzes Meer'], 1],
  ['Wie viele Bundesländer hat Deutschland?', ['14','15','16','17'], 2],
  ['Welches Tier ist ein Säugetier?', ['Hai','Wal','Forelle','Pinguin'], 1],
  ['Welche Einheit misst Leistung?', ['Volt','Watt','Ohm','Meter'], 1],
  ['Wie viele Sekunden hat eine Stunde?', ['600','1800','3600','6000'], 2],
  ['Wie heißt die Hauptstadt der Schweiz?', ['Zürich','Genf','Bern','Basel'], 2],
  ['Welcher Stoff ist härter?', ['Talk','Diamant','Gips','Graphit'], 1],
  ['Welcher Planet wird auch roter Planet genannt?', ['Jupiter','Mars','Neptun','Uranus'], 1],
  ['Wie viele Grad hat ein rechter Winkel?', ['45','90','120','180'], 1],
  ['Was ist 12 mal 12?', ['124','134','144','154'], 2],
  ['Wie viele Millimeter sind ein Zentimeter?', ['5','10','50','100'], 1]
];

const generated = Array.from({ length: 50 }, (_, i) => {
  const n = i + 1;
  const a = n + 7;
  const b = (n % 9) + 2;
  const correct = a + b;
  return [`Rechenrunde ${n}: Was ist ${a} + ${b}?`, [String(correct - 2), String(correct), String(correct + 1), String(correct + 3)], 1];
});

export const questionBank = [...general, ...generated].map(([question, answers, correct], index) => ({
  id: `default-${index + 1}`,
  question,
  answers,
  correct,
  source: 'default'
}));
