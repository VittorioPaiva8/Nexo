import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import type { Perfil } from './api/tipos';
import { useAuth } from './auth/AuthContext';
import { Carregando } from './components/Estado';
import { Layout } from './components/Layout';
import { Acompanhamento } from './pages/Acompanhamento';
import { Cadastros } from './pages/Cadastros';
import { DivergenciaDetalhe } from './pages/DivergenciaDetalhe';
import { Importar } from './pages/Importar';
import { Login } from './pages/Login';
import { MinhasPendencias } from './pages/MinhasPendencias';
import { Notas } from './pages/Notas';
import { Painel } from './pages/Painel';

function Protegida({ children, perfis }: { children: ReactNode; perfis?: Perfil[] }) {
  const { usuario, carregando, temPerfil } = useAuth();
  if (carregando) return <Carregando />;
  if (!usuario) return <Navigate to="/login" replace />;
  if (perfis && !temPerfil(...perfis)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function Inicio() {
  const { temPerfil } = useAuth();
  return <Navigate to={temPerfil('ADMIN', 'REVISOR') ? '/acompanhamento' : '/pendencias'} replace />;
}

const GESTAO: Perfil[] = ['ADMIN', 'REVISOR'];

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          element={
            <Protegida>
              <Layout />
            </Protegida>
          }
        >
          <Route index element={<Inicio />} />
          <Route path="pendencias" element={<MinhasPendencias />} />
          <Route path="divergencias/:id" element={<DivergenciaDetalhe />} />
          <Route
            path="importar"
            element={
              <Protegida perfis={GESTAO}>
                <Importar />
              </Protegida>
            }
          />
          <Route
            path="notas"
            element={
              <Protegida perfis={GESTAO}>
                <Notas />
              </Protegida>
            }
          />
          <Route
            path="acompanhamento"
            element={
              <Protegida perfis={GESTAO}>
                <Acompanhamento />
              </Protegida>
            }
          />
          <Route
            path="painel"
            element={
              <Protegida perfis={GESTAO}>
                <Painel />
              </Protegida>
            }
          />
          <Route
            path="cadastros"
            element={
              <Protegida perfis={['ADMIN']}>
                <Cadastros />
              </Protegida>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
