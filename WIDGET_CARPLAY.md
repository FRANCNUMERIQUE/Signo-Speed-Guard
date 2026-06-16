# Widget écran d'accueil & Android Auto / Apple CarPlay

Ces trois fonctionnalités nécessitent **un build natif via EAS** (Expo Application Services) et **ne peuvent pas être testées dans Expo Go ni dans l'aperçu web**. Voici l'état actuel et la marche à suivre.

---

## 1. Widget écran d'accueil

### iOS — WidgetKit (Swift)
Le widget iOS est un **App Extension Swift natif**. Steps :

1. Générer le projet natif :
   ```bash
   cd /app/frontend
   npx expo prebuild --clean
   ```
2. Ajouter une cible Widget dans Xcode (`File → New → Target → Widget Extension`).
3. Implémenter `SignoWidget.swift` qui lit le solde $FRE / vitesse / limite via **App Group UserDefaults** (suite.app.signo.shared).
4. Côté React Native, exposer un module qui écrit `currentSpeed`, `currentLimit`, `freBalance` dans le même UserDefaults à chaque mise à jour GPS.
5. Build avec EAS :
   ```bash
   eas build -p ios --profile production
   ```

### Android — AppWidgetProvider (Kotlin)
1. `npx expo prebuild --clean`
2. Créer `android/app/src/main/java/.../SignoWidgetProvider.kt` + layout `widget_signo.xml`.
3. Déclarer dans `AndroidManifest.xml` :
   ```xml
   <receiver android:name=".SignoWidgetProvider" android:exported="true">
     <intent-filter><action android:name="android.appwidget.action.APPWIDGET_UPDATE" /></intent-filter>
     <meta-data android:name="android.appwidget.provider" android:resource="@xml/signo_widget_info" />
   </receiver>
   ```
4. Côté RN, écrire dans `SharedPreferences` via un Native Module, puis appeler `WidgetManager.updateAppWidget()`.

> **Approche cross-platform recommandée** : utiliser la librairie communautaire `react-native-android-widget` (Android) et `expo-widget-extension` config plugin (iOS) — supporte Expo SDK 54 mais nécessite quand même un build EAS.

---

## 2. Android Auto

Android Auto utilise l'**API Car App Library** (Java/Kotlin). React Native ne le supporte pas directement.

1. `npx expo prebuild`
2. Ajouter à `android/app/build.gradle` :
   ```gradle
   implementation 'androidx.car.app:app:1.4.0'
   implementation 'androidx.car.app:app-projected:1.4.0'
   ```
3. Créer `SignoCarAppService.kt` extends `CarAppService`.
4. Déclarer dans `AndroidManifest.xml` :
   ```xml
   <service android:name=".SignoCarAppService" android:exported="true">
     <intent-filter><action android:name="androidx.car.app.CarAppService" /></intent-filter>
   </service>
   <meta-data android:name="com.google.android.gms.car.application" android:resource="@xml/automotive_app_desc" />
   ```
5. Build & test avec le simulateur **Desktop Head Unit (DHU)** d'Android Studio.

---

## 3. Apple CarPlay

CarPlay nécessite un **entitlement Apple** (demande à faire à Apple Developer) — sans approbation, l'app **ne peut pas apparaître** dans CarPlay même en build privé.

1. Demander l'entitlement `com.apple.developer.carplay-maps` sur [developer.apple.com](https://developer.apple.com/contact/carplay/) (réservé aux apps de navigation).
2. `npx expo prebuild --clean`
3. Ajouter dans `ios/Signo/Signo.entitlements` :
   ```xml
   <key>com.apple.developer.carplay-maps</key>
   <true/>
   ```
4. Créer `SignoCarPlaySceneDelegate.swift` qui implémente `CPMapTemplate` / `CPListTemplate`.
5. Build avec EAS.

---

## Résumé pratique

| Fonctionnalité  | Build requis | Délai Apple/Google     | Statut Signo                     |
| --------------- | ------------ | ---------------------- | -------------------------------- |
| Widget iOS      | EAS prebuild | Aucun                  | À implémenter (Swift natif)      |
| Widget Android  | EAS prebuild | Aucun                  | À implémenter (Kotlin natif)     |
| Android Auto    | EAS prebuild | Quelques jours (Google)| À implémenter                    |
| Apple CarPlay   | EAS prebuild | **6-8 semaines (Apple, audit obligatoire)** | À implémenter                    |

L'application Signo actuelle est **prête pour le prebuild** : tous les hooks GPS, le solde $FRE et les limitations sont déjà exposés via le backend, il suffit de les consommer côté natif via App Group / SharedPreferences.

> Cliquez sur le bouton **Publish (Publier)** en haut à droite de l'éditeur Emergent pour lancer le build iOS/Android — c'est là que les fonctionnalités natives s'activeront réellement.
