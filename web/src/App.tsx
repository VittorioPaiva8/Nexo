import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import type { Perfil } from './api/tipos';
import { useAuth } from './auth/AuthContext';
import { Carregando } from './components/Estado';
import { Layout } from './components/Layout';
import { Central } from './pages/Central';
import { DivergenciaDetalhe } from './pages/DivergenciaDetalhe';
import { Importar } from './pages/Importar';
import { Login } from './pages/Login';
import { MinhasTratativas } from './pages/MinhasTratativas';
import { NovaDivergencia } from './pages/NovaDivergencia';
import { Painel } from './pages/Painel';
import { Relatorios } from './pages/Relatorios';
import { Usuarios } from './pages/Usuarios';
import { Validacao } from './pages/Validacao';

const FISCAIS: Perfil[] = ['FISCAL', 'GESTOR', 'ADMIN'];

function Protegida({ children, perfis }: { children: ReactNode; perfis?: Perfil[] }) {
  const { usuario, carregando, temPerfil } = useAuth();
  if (carregando) return <Carregando />;
  if (!usuario) return <Navigate to="/login" replace />;
  if (perfis && !temPerfil(...perfis)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

/** Fiscal, gestor e admin começam no painel; o tratador, na própria fila. */
function Inicio() {
  const { temPerfil } = useAuth();
  return <Navigate to={temPerfil(...FISCAIS) ? '/painel' : '/tratativas'} replace />;
}

const restrita = (perfis: Perfil[], pagina: ReactNode) => <Protegida perfis={perfis}>{pagina}</Protegida>;

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
          <Route path="painel" element={restrita(FISCAIS, <Painel />)} />
          <Route path="divergencias" element={<Central />} />
          <Route path="divergencias/:id" element={<DivergenciaDetalhe />} />
          <Route path="nova" element={restrita(FISCAIS, <NovaDivergencia />)} />
          <Route path="importar" element={restrita(FISCAIS, <Importar />)} />
          <Route path="tratativas" element={<MinhasTratativas />} />
          <Route path="validacao" element={restrita(FISCAIS, <Validacao />)} />
          <Route path="relatorios" element={restrita(FISCAIS, <Relatorios />)} />
          <Route path="usuarios" element={restrita(['ADMIN'], <Usuarios />)} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
