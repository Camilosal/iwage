import json
import requests
import subprocess
import time

print("=== Strapi Product Reimport Script ===")
print("")

# Step 1: Login to get token
print("1. Logging in to Strapi...")
login_resp = requests.post(
    "http://127.0.0.1:1340/admin/login",
    json={"email": "camilosal@me.com", "password": "Pr@yectos123"},
    timeout=10
)
if login_resp.status_code != 200:
    print(f"   ERROR: Login failed with status {login_resp.status_code}")
    print(f"   Response: {login_resp.text[:200]}")
    exit(1)

token = login_resp.json().get("data", {}).get("token", "")
if not token:
    print("   ERROR: No token in response")
    exit(1)

print(f"   ✓ Logged in successfully")
headers = {
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/json"
}

# Step 2: Read exported products
print("")
print("2. Reading exported products...")
with open("/tmp/productos_clean.json", "r") as f:
    products = json.load(f)
print(f"   ✓ Found {len(products)} products")

# Step 3: Delete existing products from database
print("")
print("3. Deleting existing products from database...")
result = subprocess.run(
    ["docker", "exec", "sostenibilidad_db", "psql", "-U", "admin", "-d", "espacios_plus", 
     "-c", "DELETE FROM productos;"],
    capture_output=True,
    text=True
)
if result.returncode == 0:
    print("   ✓ Deleted all existing products")
else:
    print(f"   ERROR: {result.stderr}")
    exit(1)

# Wait a moment for Strapi to sync
time.sleep(2)

# Step 4: Import products via API
print("")
print("4. Importing products via Strapi API...")
print("")

success = 0
errors = 0

for i, product in enumerate(products, 1):
    try:
        data = {
            "data": {
                "nombre": product["nombre"],
                "slug": product["slug"],
                "descripcion": product.get("descripcion", ""),
                "descripcion_corta": product.get("descripcion_corta"),
                "categoria": product.get("categoria"),
                "estilo": product.get("estilo"),
                "espacio_recomendado": product.get("espacio_recomendado"),
                "precio_base": float(product["precio_base"]) if product.get("precio_base") else None,
                "precio_oferta": float(product["precio_oferta"]) if product.get("precio_oferta") else None,
                "moneda": product.get("moneda", "COP"),
                "sku": product.get("sku"),
                "disponible": product.get("disponible", True),
                "venta_online": product.get("venta_online", False),
                "venta_tienda": product.get("venta_tienda", False),
                "stock": product.get("stock"),
                "bajo_pedido": product.get("bajo_pedido", False),
                "tiempo_fabricacion_dias": product.get("tiempo_fabricacion_dias"),
                "personalizable": product.get("personalizable", False),
                "opciones_personalizacion": product.get("opciones_personalizacion"),
                "dimensiones": product.get("dimensiones"),
                "dimensiones_personalizables": product.get("dimensiones_personalizables", False),
                "rango_dimensiones": product.get("rango_dimensiones"),
                "peso_kg": float(product["peso_kg"]) if product.get("peso_kg") else None,
                "capacidad_carga_kg": float(product["capacidad_carga_kg"]) if product.get("capacidad_carga_kg") else None,
                "materiales": product.get("materiales"),
                "acabados_disponibles": product.get("acabados_disponibles"),
                "destacado": product.get("destacado", False),
                "nuevo": product.get("nuevo", False),
                "orden": product.get("orden", 0),
                "problema_que_resuelve": product.get("problema_que_resuelve"),
                "rutina_que_mejora": product.get("rutina_que_mejora"),
                "disenado_para": product.get("disenado_para"),
                "colecciones": product.get("colecciones"),
                "configurable": product.get("configurable", False),
                "variaciones": product.get("variaciones"),
                "reglas_configurador": product.get("reglas_configurador"),
                "publishedAt": "2026-07-28T19:37:24.640Z"
            }
        }
        
        response = requests.post(
            "http://127.0.0.1:1340/api/productos",
            headers=headers,
            json=data,
            timeout=30
        )
        
        if response.status_code in [200, 201]:
            print(f"   ✓ [{i}/{len(products)}] {product['nombre']}")
            success += 1
        else:
            print(f"   ✗ [{i}/{len(products)}] {product['nombre']}: {response.status_code}")
            if i == 1:  # Show first error details
                print(f"      Response: {response.text[:200]}")
            errors += 1
    except Exception as e:
        print(f"   ✗ [{i}/{len(products)}] {product['nombre']}: {str(e)}")
        errors += 1

print("")
print(f"=== Import complete ===")
print(f"   Successful: {success}")
print(f"   Errors: {errors}")
print(f"   Total: {len(products)}")
