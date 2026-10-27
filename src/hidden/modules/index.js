// Ukryte dodatki — ten bundle (private/hidden-modules.js) serwer wydaje tylko po zalogowaniu przez Discord.
// Kolejność = kolejność w panelu. `id` to klucz zapisu włączenia (localStorage "hidden_<id>") — nie zmieniać.
import au from './au.js';
import titanParty from './titan-party.js';

export default [
    au,
    titanParty,
];
