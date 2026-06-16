# Signo - PRD

## Vision
Application mobile React Native (Expo) qui informe les conducteurs en temps réel de la limitation de vitesse, de leur vitesse actuelle, et déclenche des alertes vocales/visuelles/haptiques en cas de dépassement. Récompense les conducteurs en token virtuel $FRE (1 FRE / 10 km, retrait possible sur wallet TON dès 1000 FRE).

## Stack
- **Frontend** : Expo SDK 54, expo-router, react-native-maps, expo-location, expo-speech, expo-haptics, expo-blur, expo-linear-gradient
- **Backend** : FastAPI + MongoDB (motor) + httpx
- **Données cartographiques** : OpenStreetMap via Overpass API (gratuit)
- **Auth** : Aucune (identifiant anonyme via X-Device-Id stocké en SecureStore)

## Fonctionnalités MVP
1. **Accueil** : carte GPS plein écran (style sombre), panneau de limitation européen, vitesse temps réel avec couleur dynamique (vert/orange/rouge), timeline verticale des limitations à venir (500m/2km/5km), bouton Démarrer/Arrêter trajet.
2. **Trajets** : historique avec distance, durée, vitesse moyenne, dépassements, score de sécurité.
3. **Alertes** : log de tous les dépassements de vitesse (sévérité warning/danger).
4. **Récompenses** : solde $FRE, barre de progression vers 1000 FRE, historique des gains, saisie wallet TON, réclamation (MOCKÉE — génère un faux tx_hash TON).
5. **Profil** : statistiques cumulées (trajets, distance totale, score), édition nom et wallet TON.
6. **Paramètres** : toggles alertes sonores/vocales/vibrations, mode conduite, mode hors ligne, signalements communautaires.

## API Backend (toutes routes préfixées `/api`)
- `GET /profile`, `PUT /profile`
- `GET /trips`, `POST /trips` (gain FRE auto = distance/10)
- `GET /alerts`, `POST /alerts`
- `GET /rewards`, `POST /rewards/claim` (vérifie wallet + ≥1000 FRE)
- `GET /speed-limit?lat=&lon=` (Overpass OSM)
- `GET /speed-limits/upcoming?lat=&lon=&heading=` (3 points devant)

## Limitations connues
- **MOCKED** : Réclamation TON (faux tx_hash, aucune transaction blockchain réelle)
- **Aperçu web** : carte non disponible (react-native-maps native uniquement) — la carte fonctionne sur mobile via Expo Go
- Permissions GPS requises côté natif

## Tokens design
- Surface : `#050B2E` (bleu nuit), accent `#7A3CFF` (violet électrique)
- Success `#00CC66`, Warning `#FF9900`, Error `#FF3366`
