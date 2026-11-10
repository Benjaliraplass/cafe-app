import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Eyebrow, Title } from '@/components/primitives'

export const PRIVACY_UPDATED = '10 de noviembre de 2026'
const CONTACT = 'benjamin@tostadoclub.com'

/**
 * Política de privacidad de Dripo: /privacidad (ruta pública, sin sesión).
 * Es la URL que se declara en Google Cloud (pantalla de consentimiento) y la que
 * enlazan Login y Perfil. Cualquier cambio de fondo se refleja en PRIVACY_UPDATED.
 */
export function Privacy() {
  const navigate = useNavigate()
  return (
    <div className="px-6 pb-10 pt-4">
      <Button variant="ghost" size="icon" className="-ml-2" onClick={() => navigate(-1)} aria-label="Volver">
        <ChevronLeft className="size-5" strokeWidth={1.8} />
      </Button>
      <Eyebrow className="mt-4">Dripo</Eyebrow>
      <Title className="mt-1 text-[30px]">Política de privacidad</Title>
      <p className="mt-2 text-sm text-muted-foreground">Última actualización: {PRIVACY_UPDATED}</p>

      <div className="mt-6 flex flex-col gap-6 text-[15px] leading-relaxed text-foreground">
        <P>
          Dripo es una aplicación para registrar y recordar los cafés de especialidad que pruebas. Es operada por
          Cafetero Club SpA (Tostado Club), Guardia Vieja 202, oficina 902, Providencia, Santiago de Chile. Esta
          política explica qué datos recopila Dripo, para qué los usa y qué derechos tienes sobre ellos.
        </P>

        <Section n={1} title="Datos que recopilamos">
          <ul className="flex list-disc flex-col gap-2 pl-5">
            <li>
              <strong>Cuenta:</strong> correo electrónico y contraseña (cifrada), o los datos básicos que entrega
              Google si eliges entrar con Google: nombre, correo y foto de perfil.
            </li>
            <li>
              <strong>Perfil:</strong> nombre, nacionalidad, foto de perfil, el equipo de preparación que declares
              (molino, métodos, máquina) y tu perfil de gusto (procesos, sabores y preparaciones favoritas).
            </li>
            <li>
              <strong>Tu diario de café:</strong> fotos de etiquetas, datos del café (tostador, origen, proceso,
              variedad, fecha de tueste), puntajes, notas, método de preparación, lugar y precio de compra, favoritos
              y recetas guardadas.
            </li>
            <li>
              <strong>Cafeterías:</strong> si propones una cafetería, guardamos los datos que ingreses (nombre,
              dirección, ubicación en el mapa, enlaces).
            </li>
            <li>
              <strong>Ubicación:</strong> solo si la autorizas en tu navegador, y únicamente para ordenar las
              cafeterías por distancia o centrar el mapa. No se guarda en nuestros servidores.
            </li>
            <li>
              <strong>Datos técnicos y de uso:</strong> los necesarios para mantener tu sesión iniciada (tokens
              almacenados en tu dispositivo), registros básicos de funcionamiento del servicio y eventos de uso de la
              aplicación (qué pantallas abres, cuándo escaneas, pides una receta o compartes), asociados a un
              identificador interno y nunca a tu correo. Si llegas por un enlace compartido, guardamos de quién vino.
            </li>
          </ul>
          <P>Dripo no accede a tus contactos ni a otras fotos de tu dispositivo fuera de las que tú eliges subir.</P>
        </Section>

        <Section n={2} title="Para qué usamos tus datos">
          <ul className="flex list-disc flex-col gap-2 pl-5">
            <li>Para que puedas crear tu cuenta, entrar y mantener tu diario de cafés.</li>
            <li>Para leer automáticamente la etiqueta del café a partir de la foto que subes y prellenar la ficha.</li>
            <li>Para generar recetas de preparación personalizadas según el café, el método, el equipo y el perfil de gusto que indiques.</li>
            <li>Para recomendarte cafés del catálogo afines a lo que has puntuado bien.</li>
            <li>Para entender cómo se usa Dripo (qué funciona y qué no) y mejorarla durante la beta.</li>
            <li>Para responder a tu feedback.</li>
          </ul>
          <P>No vendemos tus datos ni los usamos para publicidad de terceros.</P>
        </Section>

        <Section n={3} title="Proveedores que procesan datos">
          <ul className="flex list-disc flex-col gap-2 pl-5">
            <li>
              <strong>Supabase</strong> (base de datos, autenticación y almacenamiento de fotos), con servidores en la
              región de Sudamérica.
            </li>
            <li>
              <strong>Google Gemini</strong> (Google LLC): recibe la foto de la etiqueta y la descripción del café para
              extraer la información y sugerir recetas. Google no usa estos datos para entrenar sus modelos según los
              términos de su API.
            </li>
            <li>
              <strong>Netlify</strong>: aloja la aplicación web.
            </li>
            <li>
              <strong>OpenFreeMap y OpenStreetMap</strong>: entregan el mapa y la búsqueda de direcciones; reciben la zona
              del mapa que consultas, sin tu identidad.
            </li>
            <li>
              <strong>PostHog</strong>: analítica de producto; recibe los eventos de uso con un identificador interno,
              sin tu correo ni tu nombre.
            </li>
            <li>
              <strong>Google</strong> como proveedor de inicio de sesión, solo si eliges entrar con Google.
            </li>
          </ul>
        </Section>

        <Section n={4} title="Visibilidad de tu información">
          <P>
            Tus registros, fotos, notas y recetas son privados por defecto: solo tú puedes verlos. Si activas
            "Compartir mi registro" en un café, ese registro (puntaje, notas y método, con tu nombre de perfil) pasa a
            ser visible para quien tenga el enlace, y puedes desactivarlo cuando quieras. Los datos de catálogo que
            ayudas a completar (nombre del tostador, nombre del café, origen, proceso) pueden compartirse con otros
            usuarios para evitar duplicados, sin asociarlos a tu identidad. Las cafeterías que propones se publican
            tras revisión, sin indicar quién las propuso.
          </P>
        </Section>

        <Section n={5} title="Conservación">
          <P>
            Conservamos tus datos mientras mantengas tu cuenta. Si la eliminas, borramos tu perfil, tus registros, tus
            fotos y tus recetas dentro de 30 días, salvo que la ley exija conservar algo por más tiempo.
          </P>
        </Section>

        <Section n={6} title="Tus derechos">
          <P>
            Puedes acceder, corregir o eliminar tus datos en cualquier momento. La mayoría de los datos se editan
            directamente en la aplicación. Para eliminar tu cuenta o ejercer cualquier otro derecho reconocido por la
            Ley 19.628 sobre protección de la vida privada y su normativa complementaria, escríbenos a{' '}
            <a className="underline underline-offset-4" href={`mailto:${CONTACT}`}>
              {CONTACT}
            </a>
            . Respondemos dentro de 10 días hábiles.
          </P>
        </Section>

        <Section n={7} title="Seguridad">
          <P>
            Los datos viajan cifrados (HTTPS) y se almacenan con controles de acceso por usuario, de modo que cada
            persona solo puede leer y modificar su propia información.
          </P>
        </Section>

        <Section n={8} title="Menores de edad">
          <P>Dripo está dirigida a mayores de 18 años. Si detectamos una cuenta de un menor sin autorización, la eliminaremos.</P>
        </Section>

        <Section n={9} title="Cambios a esta política">
          <P>
            Si cambiamos esta política, actualizaremos la fecha al inicio de esta página y, si el cambio es relevante,
            te avisaremos dentro de la aplicación.
          </P>
        </Section>

        <Section n={10} title="Contacto">
          <P>
            Cafetero Club SpA (Tostado Club) · Guardia Vieja 202, oficina 902, Providencia, Santiago de Chile ·{' '}
            <a className="underline underline-offset-4" href={`mailto:${CONTACT}`}>
              {CONTACT}
            </a>
          </P>
        </Section>
      </div>

      <div className="mt-10">
        <Button asChild variant="outline" className="w-full">
          <Link to="/">Ir a Dripo</Link>
        </Button>
      </div>
    </div>
  )
}

function Section({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[18px] font-medium leading-tight tracking-[-0.01em]">
        {n}. {title}
      </h2>
      {children}
    </section>
  )
}

function P({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground">{children}</p>
}
