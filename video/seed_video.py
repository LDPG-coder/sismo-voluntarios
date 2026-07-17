import uuid
from datetime import UTC, datetime, timedelta
from app.db.base import SessionLocal
from app.db.models.identity import User
from app.db.models.activities import Activity
from app.db.models.activity_members import ActivityMember
from app.db.models.activity_evidence import ActivityEvidence
from app.db.models.notifications import Notification
from app.db.enums import UserRole, UserStatus, ActivityStatus
from app.db.constants import MVP_TENANT_ID

db = SessionLocal()
now = datetime.now(UTC)
DEV_ID = uuid.UUID('11111111-1111-1111-1111-111111111111')
dev = db.get(User, DEV_ID)
assert dev, 'dev admin missing'
dev.phone = '+56 9 5555 1234'

db.query(Notification).delete()
db.query(ActivityEvidence).delete()
db.query(ActivityMember).delete()
db.query(Activity).delete()
db.flush()

def make_user(name, email, phone):
    u = db.query(User).filter(User.email == email).one_or_none()
    if not u:
        u = User(id=uuid.uuid4(), email=email, tenant_id=MVP_TENANT_ID, auth_source='sep',
                 referral_code=uuid.uuid4().hex[:10].upper())
        db.add(u); db.flush()
    u.name = name
    u.phone = phone
    u.role = UserRole.volunteer
    u.status = UserStatus.active
    return u

ana = make_user('Ana Becaria', 'ana@sismo.local', '+56 9 6111 2233')
car = make_user('Carlos Ayudante', 'carlos@sismo.local', '+56 9 6222 3344')

# Actividades priorizadas: ayuda comunitaria post-sismo (centro de acopio,
# universidad, insumos, recreación con niños, reciclaje, etc.)
specs = [
  ('Ir al centro de acopio a entregar insumos', 'Caracas',
   'Centro de acopio Sector Norte, Av. Costanera 1200, Valparaiso',
   'Lleva alimentos no perecederos, agua y ropa abrigada al centro de acopio del sector.', ana, 1),
  ('Ordenar y clasificar insumos en centro de acopio', 'La Guaira',
   'Centro de acopio La Fe, Calle Los Olmos 45, Vina del Mar',
   'Ayuda a separar, etiquetar y organizar los donativos recibidos para su distribucion.', car, 2),
  ('Apoyo en la universidad: acompanamiento a estudiantes', 'Caracas',
   'Universidad de Playa Ancha, Calle Maipu 300, Valparaiso',
   'Apoya en la recepcion y orientacion de estudiantes damnificados que retoman clases.', ana, 3),
  ('Recreacion con ninos en albergue temporal', 'Guatire',
   'Albergue Temporal Gimnasio Municipal, Guatire',
   'Dinamicas, juegos y cuentos para los ninos alojados en el albergue temporal.', car, 4),
  ('Reciclaje de desperdicios en centros de acopio', 'Maracay',
   'Centro de acopio Caucagua, Pasaje El Bosque 9, Caucagua',
   'Separa y recicla materiales para reducir el desperdicio en el centro de acopio.', ana, 5),
  ('Jornada oficial AVAA: reforestacion post-sismo', 'Valencia',
   'Quebrada El Arrayan, Vina del Mar',
   'Voluntariado oficial de AVAA para reforestar las quebradas afectadas por el sismo.', ana, 6),
  ('Evaluacion de danos estructurales', 'Los Teques',
   'Pasaje El Bosque 9, Quilpue',
   'Relevamiento de viviendas con dano estructural para priorizar atencion.', car, 7),
  ('Taller de preparacion sismica para familias', 'Caracas',
   'Plaza Principal, Santiago',
   'Charla y simulacro de evacuacion para familias damnificadas.', ana, 9),
]
for title, zone, addr, desc, owner, day in specs:
    a = Activity(title=title, description=desc, zone=zone, raw_address=addr,
                 date_time=now+timedelta(days=day, hours=10),
                 end_time=now+timedelta(days=day, hours=12),
                 estimated_duration_min=120, max_participants=20,
                 requirements='Ropa comoda y botella de agua.', contact_info=owner.email,
                 creator_id=owner.id, tenant_id=MVP_TENANT_ID, status=ActivityStatus.active)
    db.add(a)

db.add(Activity(title='Campana de recoleccion de libros', description='Recoleccion de libros para la biblioteca comunitaria.',
                zone='Guatire', raw_address='Calle Serrano 50, Caracas',
                date_time=now+timedelta(days=8, hours=10), end_time=now+timedelta(days=8, hours=12),
                estimated_duration_min=90, max_participants=15, requirements='Cajas de carton.',
                contact_info='dev@sismo.local', creator_id=dev.id, tenant_id=MVP_TENANT_ID,
                status=ActivityStatus.active))

db.commit()
print('seeded video activities:', db.query(Activity).count(), 'users:', db.query(User).count())
db.close()
