import { Alert, Button, Paper, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconAlertTriangle } from '@tabler/icons-react';
import { useState } from 'react';
import { Navigate } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { Marca } from '../components/Marca';
import { CORES_ITAX } from '../theme';

/** Tela de login: fundo preto com degradê vermelho, conforme a identidade institucional. */
export function Login() {
  const { usuario, entrar } = useAuth();
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const form = useForm({
    initialValues: { email: '', senha: '' },
    validate: {
      email: (v) => (/^\S+@\S+\.\S+$/.test(v) ? null : 'Informe um e-mail válido'),
      senha: (v) => (v.length >= 6 ? null : 'A senha tem no mínimo 6 caracteres'),
    },
  });

  if (usuario) return <Navigate to="/" replace />;

  const enviar = form.onSubmit(async ({ email, senha }) => {
    setErro(null);
    setEnviando(true);
    try {
      await entrar(email, senha);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível entrar');
    } finally {
      setEnviando(false);
    }
  });

  return (
    <div className="fundo-login" style={{ display: 'grid', placeItems: 'center', padding: 16 }}>
      <Stack w="100%" maw={400} gap="xl">
        <Stack gap={6} align="center">
          <Marca tamanho="xl" />
          <Text c={CORES_ITAX.cinzaClaro} fz="sm" ta="center">
            Central de divergências de notas fiscais
          </Text>
        </Stack>
        <Paper
          p="xl"
          radius="lg"
          bg={CORES_ITAX.pretoSuave}
          style={{ border: `1px solid ${CORES_ITAX.cinzaEscuro}` }}
        >
          <form onSubmit={enviar}>
            <Stack>
              <Title order={3} c="white">
                Entrar
              </Title>
              {erro && (
                <Alert color="itaxRed" variant="filled" icon={<IconAlertTriangle size={18} />}>
                  {erro}
                </Alert>
              )}
              <TextInput
                label="E-mail"
                placeholder="voce@empresa.com.br"
                autoComplete="email"
                styles={{ label: { color: 'white' } }}
                {...form.getInputProps('email')}
              />
              <PasswordInput
                label="Senha"
                autoComplete="current-password"
                styles={{ label: { color: 'white' } }}
                {...form.getInputProps('senha')}
              />
              <Button type="submit" loading={enviando} fullWidth mt="xs">
                Entrar
              </Button>
            </Stack>
          </form>
        </Paper>
      </Stack>
    </div>
  );
}
