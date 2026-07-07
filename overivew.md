### project needs
i have a google sheet file that contains the plannifiction of actions which affect action to intern employee in our company, so the file has several fields or columns such task reference, action, affected to, starting date, ending date, priority, customer, adress. and i want when new action added the employee get notified by that and update his actions list in order to do that action via mobile application, once the employee get notifiyed by the new action he should be persistent to do that action in the required range of time, and he has 4 different action status he should select are : in progress, finished, cancelled and postponed.

also we have company domain for google mail, in other word every employee have specific email adress that ends with @airliquide.com


so check this few data in my google sheet with the header : 
N°,ACTION,Affectée à,Date début,Date d'échéance,Nom de table,N° enregistrement,N° période,Code Action,Code Patient,Nom Patient,Adresse,N° téléphone,Affectée par,Priorité,Clôturée,Date de clôture,Annulée,Créé par,Date de création,Statut
ACT20-00260001,VISITE POUR RAPPORT D'OBSERVANCE,ALFRGIS\SAMI.GHARBI,2026-02-01,2026-07-01,Dossier location,D26-005120,2,VISITERO,PT41029,YASSINE BEN ALI,TUNIS,98 123 456,,Normale,False,,False,ALFRGIS\MOUFIDA.T,2026-02-01 09:15:00,En cours
ACT20-00260002,RELANCER P CREUSE AVANT LE RDV,ALFRGIS\SAMI.GHARBI,2026-02-01,2026-07-01,Dossier location,D26-005120,2,RELANCEVISITL,PT41029,YASSINE BEN ALI,TUNIS,98 123 456,,Normale,False,,False,ALFRGIS\MOUFIDA.T,2026-02-01 09:15:00,En cours
ACT20-00260003,Renouvellement Période Tranche 1,ALFRGIS\LEILA.MANSOUR,2026-02-03,2026-07-03,Dossier location,D26-008412,4,RNPERTRANCHE1L,PT43210,NIZAR TRABELSI,SFAX,22 456 789,,Normale,False,,False,ALFRGIS\SABRINE.K,2026-02-03 10:20:45,En cours

so propose enhacement for this needs and recommandation.
so propose the technical stack including the mobile app technologie the server and the database.

and don't write any code until i tell you



### Project overview
You're replacing a Google Sheet-based action tracking process at Air Liquide with a proper client-server system, while keeping the fundamentals of what the Sheet already does: tracking actions tied to patient/customer records, assigned to specific field employees, sorted by deadline and priority.
How actions get created
There are two paths into the system, not one. An admin can create and assign an action directly through the admin panel, writing straight to the database. Or an action originates upstream — from Navision or another source — landing as a new row in the Google Sheet, which the backend picks up through a scheduled sync (or an Apps Script trigger firing a webhook on new-row-added) and inserts into the same actions table. Both paths converge on the same record and trigger the same initial-assignment notification to the employee, resolved through the AD-username-to-email mapping since upstream sources will likely keep writing the domain\username format the Sheet uses today.
This makes the Sheet a permanent ingestion boundary, not a temporary stepping stone — it's still needed even once the admin panel exists, specifically as the intake point for automated/external sources. The sync only flows one direction: Sheet into database. Status changes made afterward (Finished, Cancelled, Postponed) live only in the database and admin panel and never get written back into the Sheet, which avoids the concurrency problems of editing the same data in two places. If a live view of current status is needed on the Sheet side, that's better served by a periodically regenerated read-only report than a two-way sync.
The core workflow
Once an action exists, it's assigned to an employee (identified by @airliquide.com email) who sees only their own actions in a mobile app. Each action moves through four states:

In progress — the default state, action is active and awaiting resolution.
Finished — the employee closes it themselves from the app; this notifies every admin by email and moves the action out of the active plan into a finished-actions view.
Cancelled — either the employee or an admin can trigger this; whichever side didn't initiate it gets notified (employee cancels → admins notified by email; admin cancels → that employee notified by push).
Postponed — the only status the system sets on its own. A scheduled job checks for actions still In progress past their deadline and flips them automatically, notifying the employee that the window passed.

Roles
Every user has a role: employee or admin, and there can be more than one admin. Employees only ever see actions assigned to them, enforced at the backend query level, not just hidden in the UI. Admins see everything across all employees, can create and assign new actions, cancel any action, and manage users — adding people, assigning or changing roles, and deactivating accounts (never a hard delete, so historical action records stay intact).
Data model
One actions table carries the four-state status field, replacing the current redundant Clôturée/Annulée booleans, plus who initiated each status change and when. A companion status-history log gives you an audit trail. One users table holds email, role, and an active flag. "Plan" and "finished actions" aren't separate tables — they're the same table filtered by status, avoiding the referential-integrity headaches of physically moving rows between tables.
Architecture

Mobile app — Ionic + Angular (via Capacitor), building on your existing Angular experience, with native push notification support.
Admin panel — a separate Angular route in the same frontend project, gated by the role check, rather than a standalone app.
Backend — FastAPI, serving both the mobile app and admin panel, owning all business logic: the status state machine, role-based query scoping, the overdue check, and the Sheet ingestion sync.
Database — PostgreSQL, the live source of truth for actions and status.
Google Sheet — permanent ingestion point for upstream sources like Navision, feeding new actions into the database one-way; not a live two-way store once actions exist.
Notifications — Firebase Cloud Messaging for push, Gmail/SMTP for email, triggered from the backend depending on who acted and who needs to know.
Auth — Google Sign-In restricted to the airliquide.com Workspace domain, with the role field determining what each authenticated user can see and do.




### edges cases
employe get action that end in early date, so automatically put it in postponed history