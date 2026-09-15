// Dokumenty prawne serwisu (statyczne, po polsku). Adres URL każdego dokumentu = `slug`.
// `usuwanie-danych` jest wymagane przez Meta (Data Deletion Instructions URL) dla aplikacji
// „Infinitiq", przez którą klienci podłączają Messenger i Instagram strony firmowej.
// Administrator: Greywolf Group (marka Fastline InfinitiQ). Dane rejestrowe (NIP, adres)
// uzupełnia właściciel — patrz ADMIN poniżej.

export const ADMIN = {
  name: 'Greywolf Group',
  brand: 'Fastline InfinitiQ',
  email: 'infinitiq@fastline.pl',
  site: 'https://fastlineinfinitiq.pl',
  address: '', // np. „ul. …, 00-000 Warszawa" — puste = nie pokazujemy wiersza
  nip: '',
};
const UPDATED = '15 września 2026';
const adminLine = () =>
  `${ADMIN.name} (marka ${ADMIN.brand})${ADMIN.address ? `, ${ADMIN.address}` : ''}${ADMIN.nip ? `, NIP ${ADMIN.nip}` : ''}, e-mail: ${ADMIN.email}`;

export const LEGAL = {
  'polityka-prywatnosci': {
    label: 'Dokumenty — 01',
    title: 'Polityka prywatności',
    lead: 'Jakie dane przetwarzamy, po co, na jakiej podstawie i jak długo — na stronie, w panelu klienta i w usługach agentów AI.',
    updated: UPDATED,
    sections: [
      {
        h: 'Administrator danych',
        p: [
          `Administratorem danych osobowych jest ${adminLine()}. W sprawach ochrony danych napisz na ten adres — odpowiadamy w ciągu 14 dni.`,
          'Polityka dotyczy serwisu fastlineinfinitiq.pl, paneli klienta (brain.fastlineinfinitiq.pl, hand.fastlineinfinitiq.pl) oraz usług agentów AI świadczonych naszym klientom.',
        ],
      },
      {
        h: 'Jakie dane zbieramy i po co',
        p: [
          'Formularz „Darmowy audyt AI": adres e-mail, adres strony internetowej firmy i kod weryfikacyjny. Cel: przygotowanie i wysłanie raportu audytu oraz kontakt w jego sprawie (art. 6 ust. 1 lit. b i f RODO). Raport tworzymy na podstawie publicznie dostępnych treści wskazanej strony.',
          'Formularz briefingu: imię, firma, e-mail, adres strony, wybrane obszary problemów i termin rozmowy. Cel: umówienie i przeprowadzenie rozmowy o współpracy oraz przypomnienie o terminie (art. 6 ust. 1 lit. b RODO).',
          'Panel klienta: login, adres e-mail, hasło (przechowywane wyłącznie w postaci skrótu), dziennik logowań. Cel: świadczenie usługi i bezpieczeństwo konta (art. 6 ust. 1 lit. b i f RODO).',
          'Korespondencja: treść wiadomości i dane kontaktowe nadawcy. Cel: odpowiedź i archiwizacja kontaktu (art. 6 ust. 1 lit. f RODO).',
        ],
      },
      {
        h: 'Agenci AI i kanały komunikacji klientów',
        p: [
          'Nasi klienci (firmy) uruchamiają u nas agentów AI, którzy odpowiadają ich klientom w kanałach takich jak czat na stronie, WhatsApp, Instagram, Messenger, LinkedIn, Telegram, e-mail i telefon. W tym zakresie administratorem danych osób piszących jest firma-klient, a Fastline InfinitiQ działa jako podmiot przetwarzający na podstawie umowy powierzenia (art. 28 RODO).',
          'Przetwarzamy wtedy: identyfikator rozmówcy w danym kanale, nazwę wyświetlaną, treść wiadomości, znaczniki czasu oraz dane techniczne niezbędne do dostarczenia odpowiedzi. Treść jest przekazywana do modelu językowego wyłącznie w celu wygenerowania odpowiedzi w imieniu firmy-klienta.',
          'Dane z platform Meta (Messenger, Instagram) otrzymujemy przez aplikację „Infinitiq" po tym, jak firma-klient podłączy swoją stronę lub konto firmowe. Zakres: identyfikator strony, identyfikator i nazwa rozmówcy, treść wiadomości. Nie publikujemy niczego w imieniu strony poza odpowiedziami w rozmowie i nie wykorzystujemy tych danych do własnego marketingu. Instrukcja usunięcia danych: /usuwanie-danych.',
          'Konta WhatsApp, Instagram, LinkedIn i Telegram klienci podłączają samodzielnie przez dostawcę Unipile — logowanie odbywa się po stronie dostawcy, my nie otrzymujemy ani nie przechowujemy haseł.',
        ],
      },
      {
        h: 'Odbiorcy danych i podwykonawcy',
        p: [
          'Hosting i baza danych: Supabase (serwery w Unii Europejskiej). Poczta transakcyjna: Resend. Kanały komunikacji: Meta Platforms (Messenger, Instagram, WhatsApp Cloud API), Unipile (podłączanie kont komunikatorów), ElevenLabs i Twilio (rozmowy telefoniczne agenta), Google (Places, Fonts).',
          'Modele językowe: dostawcy modeli AI (m.in. DeepSeek) oraz własna infrastruktura obliczeniowa. Do modelu trafia wyłącznie treść potrzebna do wygenerowania odpowiedzi; nie wykorzystujemy danych naszych klientów do trenowania modeli.',
          'Część dostawców przetwarza dane poza Europejskim Obszarem Gospodarczym. Przekazanie odbywa się na podstawie standardowych klauzul umownych Komisji Europejskiej lub decyzji o adekwatności (Data Privacy Framework).',
        ],
      },
      {
        h: 'Jak długo przechowujemy dane',
        p: [
          'Zgłoszenia z formularzy — do 24 miesięcy od ostatniego kontaktu, chyba że wcześniej dojdzie do współpracy (wtedy przez czas umowy i okres przedawnienia roszczeń).',
          'Rozmowy prowadzone przez agentów AI — przez czas trwania umowy z firmą-klientem; firma może je usunąć z panelu w każdej chwili. Po zakończeniu umowy usuwamy je w ciągu 30 dni.',
          'Dane z platform Meta — do momentu odłączenia strony w panelu lub żądania usunięcia (patrz /usuwanie-danych), nie dłużej niż przez czas umowy.',
          'Logi techniczne — do 90 dni.',
        ],
      },
      {
        h: 'Twoje prawa',
        p: [
          'Masz prawo dostępu do danych, ich sprostowania, usunięcia, ograniczenia przetwarzania, przenoszenia oraz sprzeciwu wobec przetwarzania opartego na uzasadnionym interesie. Wystarczy e-mail na adres administratora.',
          'Jeśli piszesz do firmy obsługiwanej przez naszego agenta AI, z żądaniem zwróć się do tej firmy albo do nas — przekażemy je administratorowi i pomożemy w realizacji.',
          'Masz prawo wnieść skargę do Prezesa Urzędu Ochrony Danych Osobowych (ul. Stawki 2, 00-193 Warszawa).',
        ],
      },
      {
        h: 'Zautomatyzowane decyzje',
        p: [
          'Agenci AI generują treść odpowiedzi automatycznie, ale nie podejmują wobec Ciebie decyzji wywołujących skutki prawne ani podobnie istotnych. W każdej chwili możesz poprosić o kontakt z człowiekiem — agent przekazuje rozmowę.',
        ],
      },
      {
        h: 'Zmiany polityki',
        p: [`Aktualna wersja obowiązuje od ${UPDATED}. O istotnych zmianach informujemy na tej stronie.`],
      },
    ],
  },

  'polityka-cookies': {
    label: 'Dokumenty — 02',
    title: 'Polityka cookies',
    lead: 'Krótko: nie używamy cookies reklamowych ani analitycznych. Poniżej to, co faktycznie zapisujemy w Twojej przeglądarce.',
    updated: UPDATED,
    sections: [
      {
        h: 'Czym są cookies i podobne technologie',
        p: [
          'Cookies to małe pliki zapisywane przez przeglądarkę. Podobnie działa localStorage — pamięć przeglądarki, z której korzystają aplikacje internetowe. Obie technologie mogą służyć do zapamiętania sesji albo ustawień.',
        ],
      },
      {
        h: 'Co zapisujemy',
        p: [
          'Strona fastlineinfinitiq.pl nie zapisuje cookies. Nie ma na niej narzędzi analitycznych, pikseli reklamowych ani śledzenia między witrynami.',
          'Panel edycji treści i panele klienta zapisują w localStorage token sesji po zalogowaniu oraz wybrane ustawienia (motyw, ostatnio wybrany projekt). To dane niezbędne do działania usługi (art. 173 ust. 3 Prawa telekomunikacyjnego) — nie wymagają zgody i nie służą do śledzenia.',
          'Widget czatu osadzony na stronie klienta zapisuje w przeglądarce identyfikator rozmowy, żeby historia nie ginęła po odświeżeniu. Identyfikator jest losowy i nie łączy się z Twoją tożsamością.',
        ],
      },
      {
        h: 'Usługi zewnętrzne',
        p: [
          'Czcionki ładujemy z Google Fonts — przeglądarka przekazuje Google adres IP w celu pobrania plików. Google nie ustawia przy tym cookies.',
          'Treści z bazy danych pobieramy z Supabase (UE). Połączenie nie zapisuje cookies na stronie publicznej.',
        ],
      },
      {
        h: 'Jak zarządzać',
        p: [
          'Zawartość localStorage i cookies możesz usunąć w ustawieniach przeglądarki („wyczyść dane witryn"). Po usunięciu zostaniesz wylogowany z paneli.',
        ],
      },
    ],
  },

  regulamin: {
    label: 'Dokumenty — 03',
    title: 'Regulamin serwisu',
    lead: 'Zasady korzystania ze strony fastlineinfinitiq.pl, formularzy i bezpłatnego audytu. Warunki usług dla klientów określa osobna umowa.',
    updated: UPDATED,
    sections: [
      {
        h: 'Postanowienia ogólne',
        p: [
          `Serwis prowadzi ${adminLine()}. Regulamin określa zasady korzystania ze strony, formularzy kontaktowych oraz bezpłatnego audytu AI.`,
          'Korzystanie z serwisu jest bezpłatne i nie wymaga rejestracji. Panele klienta są dostępne wyłącznie dla firm, z którymi zawarliśmy umowę.',
        ],
      },
      {
        h: 'Bezpłatny audyt AI',
        p: [
          'Audyt jest raportem informacyjnym generowanym automatycznie na podstawie publicznie dostępnych treści strony wskazanej w formularzu oraz publicznych wyników wyszukiwania. Nie stanowi porady prawnej, finansowej ani gwarancji wyników.',
          'Zamawiając audyt, oświadczasz, że masz prawo wskazać daną stronę do analizy (jesteś jej właścicielem albo działasz w jego imieniu). Możemy odmówić wykonania audytu dla stron naruszających prawo.',
          'Raport jest dostępny pod indywidualnym adresem. Nie publikujemy go ani nie udostępniamy osobom trzecim.',
        ],
      },
      {
        h: 'Formularze i kontakt',
        p: [
          'Wysyłając formularz, podajesz dane prawdziwe i dotyczące Ciebie lub firmy, w której imieniu działasz. Zasady przetwarzania danych opisuje Polityka prywatności.',
          'Rozmowa briefingowa umówiona przez formularz jest niezobowiązująca dla obu stron.',
        ],
      },
      {
        h: 'Własność intelektualna',
        p: [
          'Treści, grafiki, logotypy i kod serwisu są chronione prawem autorskim. Wykorzystanie poza dozwolonym użytkiem wymaga naszej zgody.',
          'Nazwy i logotypy produktów oraz platform osób trzecich (Meta, WhatsApp, Instagram, LinkedIn, Telegram, Google) należą do ich właścicieli i są używane wyłącznie w celach informacyjnych.',
        ],
      },
      {
        h: 'Odpowiedzialność',
        p: [
          'Dokładamy starań, by serwis działał bez przerw, ale nie gwarantujemy jego nieprzerwanej dostępności. Nie odpowiadamy za skutki decyzji podjętych na podstawie treści informacyjnych serwisu, w tym raportów audytu.',
        ],
      },
      {
        h: 'Reklamacje i postanowienia końcowe',
        p: [
          `Reklamacje dotyczące działania serwisu przyjmujemy na adres ${ADMIN.email}; odpowiadamy w ciągu 14 dni.`,
          `Regulamin obowiązuje od ${UPDATED}. W sprawach nieuregulowanych stosuje się prawo polskie. Spory z konsumentami rozstrzyga sąd właściwy według przepisów ogólnych; konsument może też skorzystać z platformy ODR (ec.europa.eu/consumers/odr).`,
        ],
      },
    ],
  },

  'usuwanie-danych': {
    label: 'Dokumenty — 04',
    title: 'Usuwanie danych',
    lead: 'Instrukcja usunięcia danych przetwarzanych przez aplikację „Infinitiq" (Messenger, Instagram) oraz przez naszych agentów AI.',
    updated: UPDATED,
    sections: [
      {
        h: 'Jakie dane możesz usunąć',
        p: [
          'Jeśli rozmawiałeś z agentem AI firmy obsługiwanej przez Fastline InfinitiQ w Messengerze, na Instagramie, WhatsAppie lub innym kanale — możesz poprosić o usunięcie historii tej rozmowy i powiązanych z nią identyfikatorów.',
          'Jeśli jesteś firmą, która podłączyła stronę na Facebooku lub konto Instagram do naszej aplikacji — możesz odłączyć ją w panelu (Integracje → Odłącz). Odłączenie kończy przekazywanie danych; historię rozmów usuwasz w panelu lub na żądanie.',
        ],
      },
      {
        h: 'Jak złożyć żądanie',
        p: [
          `Napisz na ${ADMIN.email} z tematem „Usunięcie danych". Podaj kanał (np. Messenger), nazwę firmy lub strony, z którą rozmawiałeś, oraz — jeśli możesz — datę rozmowy. Nie musisz podawać niczego więcej; jeśli będziemy potrzebowali potwierdzić tożsamość, zapytamy.`,
          'Firmy-klienci mogą usuwać rozmowy samodzielnie w panelu (Dashboard → Konwersacje → Usuń) — działa to natychmiast i nieodwracalnie.',
        ],
      },
      {
        h: 'Co i kiedy usuwamy',
        p: [
          'W ciągu 30 dni od otrzymania żądania usuwamy: treść wiadomości, identyfikatory rozmówcy w danym kanale, znaczniki czasu i wygenerowane odpowiedzi. Po usunięciu potwierdzamy to e-mailem.',
          'Nie usuwamy danych, których przechowywanie jest wymagane prawem (np. dokumenty księgowe) — o takim przypadku poinformujemy w odpowiedzi.',
          'Usunięcie u nas nie usuwa kopii wiadomości po stronie platformy (Meta, WhatsApp) ani w Twojej własnej aplikacji — te dane usuwasz w ustawieniach danej platformy.',
        ],
      },
      {
        h: 'Automatyczne żądania z Facebooka',
        p: [
          'Gdy usuniesz aplikację „Infinitiq" z ustawień swojego konta Facebook (Ustawienia → Aplikacje i witryny), Meta przekazuje nam sygnał, a my usuwamy dane powiązane z Twoim identyfikatorem w ciągu 30 dni. Możesz też skorzystać z instrukcji powyżej.',
        ],
      },
    ],
  },
};

export const LEGAL_LINKS = [
  ['/polityka-prywatnosci', 'Polityka prywatności'],
  ['/polityka-cookies', 'Cookies'],
  ['/regulamin', 'Regulamin'],
  ['/usuwanie-danych', 'Usuwanie danych'],
];
