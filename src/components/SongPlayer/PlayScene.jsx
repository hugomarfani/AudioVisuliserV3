import ShaderVisuals from '../../shader/ShaderVisuals';
import frozenLetItGo from '../../../assets/audio/frozen_let_it_go.mp3'

const PlayScene = () => {
  return (
    <>
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        <ShaderVisuals track={{
              title: 'Let It Go',
              artist: 'Idina Menzel',
              albumArt:
                'https://cdn-images.dzcdn.net/images/cover/f669aa7623ad8af5fbeb5a196346013a/500x500.jpg',
            }} />
    </div>
  </>
  );
};

export default PlayScene;
