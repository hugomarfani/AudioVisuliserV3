export type Song = {
  id: string;
  title: string;
  artist: string;
  albumArt: string;
  status: 'Blue' | 'Green' | 'Yellow' | 'Red';
};

export const songs: Song[] = [
  {
    id: 'spotify:track:0qcr5FMsEO85NAQjrlDRKo',
    title: 'Let It Go',
    artist: 'Idina Menzel',
    albumArt: 'letitgo',
    status: 'Blue',
  },
  {
    id: '2',
    title: 'Into the Unknown',
    artist: 'Idina Menzel',
    albumArt: '../../../assets/icon.png',
    status: 'Blue',
  },
  {
    id: '3',
    title: 'Hakuna Matata',
    artist: 'Nathan Lane, Ernie...',
    albumArt: '/hakuna-matata.jpg',
    status: 'Green',
  },
  {
    id: '4',
    title: 'Un Poco Loco',
    artist: 'Anthony Gonzalez',
    albumArt: '/un-poco-loco.jpg',
    status: 'Green',
  },
  {
    id: '5',
    title: "You're Welcome",
    artist: 'Dwayne Johnson',
    albumArt: '/youre-welcome.jpg',
    status: 'Red',
  },
  {
    id: '6',
    title: "We Don't Talk About Bruno",
    artist: 'Carolina Gaitán',
    albumArt: '/we-dont-talk.jpg',
    status: 'Red',
  },
  {
    id: '7',
    title: 'Under the Sea',
    artist: 'Samuel E. Wright',
    albumArt: '/under-the-sea.jpg',
    status: 'Yellow',
  },
];
