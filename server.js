const express = require("express");
const csv = require("csv-parser");
const fs = require("fs");
const Sequelize = require("sequelize");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
const e = require("express");

const app = express();
const sequelize = new Sequelize("mysql://root@localhost/delilahresto");

app.use(bodyParser.json());

//MIDDLEWARES

function productoExistente(req, res, next) {
  const productoNuevo = req.body;
  sequelize
    .query("SELECT * FROM Productos", { type: sequelize.QueryTypes.SELECT })
    .then(function (arrayProductos) {
      const productoRepetido = arrayProductos.find(
        (producto) => producto.Nombre === productoNuevo.nombre
      );
      if (!productoRepetido) {
        next();
      } else {
        res.status(404);
        res.send("Error, producto repetido");
      }
    });
}

function validarUsuarioContraseña(req, res, next) {
  const usuarioIngresado = req.body;
  sequelize
    .query("SELECT * FROM Usuarios", { type: sequelize.QueryTypes.SELECT })
    .then(function (arrayUsuarios) {
      const usuarioValidado = arrayUsuarios.find(
        (fila) =>
          fila.Usuario === usuarioIngresado.nombreUsuario &&
          fila.Contraseña === usuarioIngresado.contraseña
      );
      if (!usuarioValidado) {
        res.status(404);
        res.send("Error, usuario o contraseña incorrectos");
      } else {
        next();
      }
    });
}

function usuarioRepetido(req, res, next) {
  const usuario = req.body;
  sequelize
    .query("SELECT Usuario, Correo_electronico FROM Usuarios", {
      type: sequelize.QueryTypes.SELECT,
    })
    .then(function (arrayUsuarios) {
      const usuarioRepetido = arrayUsuarios.find(
        (fila) =>
          fila.Usuario === usuario.usuario ||
          fila.Correo_electronico === usuario.correoElectronico
      );
      if (usuarioRepetido) {
        res.status(404);
        res.send("Error, usuario ya existente");
      } else {
        next();
      }
    });
}

function esAdmin(req, res, next) {
  const token = req.headers.authorization.split(" ")[1];
  const descodificado = jwt.verify(token, "1234");
  sequelize
    .query(
      "SELECT Tipo_usuario FROM usuarios WHERE Usuario = ?",
      { replacements: [descodificado] },
      { type: sequelize.QueryTypes.SELECT }
    )
    .then(function (resultado) {
      if (resultado[0][0].Tipo_usuario === "admin") {
        next();
      } else {
        res.status(400);
        res.send("Acceso denegado");
      }
    });
}

function verificarDatos(req, res, next) {
  const pedido = req.body;
  sequelize
    .query("SELECT * FROM productos", { type: sequelize.QueryTypes.SELECT })
    .then(function (resultado) {
      if (
        pedido.Forma_de_pago != "Efectivo" &&
        pedido.Forma_de_pago != "Tarjeta de credito" &&
        pedido.Forma_de_pago != "Tarjeta de debito"
      ) {
        console.log("Error, forma de pago incorrecta");
      } else {
        console.log(pedido.Forma_de_pago);
      }
      if (!pedido.Direccion) {
        console.log("Error, ingrese alguna direccion");
      } else {
        next();
        console.log(pedido.Direccion);
      }
    });
}

function verificarProductos(req, res, next) {
  const pedido = req.body;
  sequelize
    .query("SELECT Nombre FROM productos", {
      type: sequelize.QueryTypes.SELECT,
    })
    .then(function (resultado) {
      function productoAVerificar(elemento) {
        const productoEncontrado = resultado.find(
          (fila) => fila.Nombre === elemento
        );
        if (productoEncontrado) {
          return true;
        }
      }

      const pedidoCorrecto = pedido.Producto.every(productoAVerificar);

      if (pedidoCorrecto) {
        next();
      } else {
        console.log("Error");
      }
    });
}

function usuarioLogueado(req, res, next) {
  const token = req.headers.authorization.split(" ")[1];
  if (token) {
    const descodificado = jwt.verify(token, "1234");
    if (descodificado) {
      console.log(descodificado);
      next();
    }
  } else {
    console.log("Error, usuario debe estar logueado");
  }
}

//ENDPOINTS

//PRODUCTOS

app.listen(3000, () => {
  console.log("Servidor iniciando");
});
app.get("/productos", (req, res) => {
  sequelize
    .query("SELECT * FROM Productos", { type: sequelize.QueryTypes.SELECT })
    .then(function (resultado) {
      res.status(200);
      res.send(resultado);
    });
});

app.get("/productos/:idProducto", (req, res) => {
  const id = req.params.idProducto;
  sequelize
    .query(
      "SELECT * FROM Productos WHERE id = ?",
      { replacements: [id] },
      { type: sequelize.QueryTypes.SELECT }
    )
    .then(function (resultado) {
      res.send(resultado);
    });
});

app.post("/productos", esAdmin, productoExistente, (req, res) => {
  const productoNuevo = req.body;
  sequelize
    .query("INSERT INTO Productos (ID, Nombre, Precio) VALUES (NULL, ?, ?)", {
      replacements: [productoNuevo.nombre, productoNuevo.precio],
    })
    .then(function (resultado) {
      res.status(200);
      res.send("Producto agregado");
      console.log(resultado);
    });
});

app.put("/productos/:idProducto", esAdmin, (req, res) => {
  const id = req.params.idProducto;
  const { nombre, precio } = req.body;
  sequelize
    .query("UPDATE Productos SET nombre = ?, precio = ? WHERE id = ?", {
      replacements: [nombre, precio, id],
    })
    .then(function (resultado) {
      res.send("Producto actualizado");
    });
});

app.delete("/productos/:idProducto", esAdmin, (req, res) => {
  const id = req.params.idProducto;
  sequelize
    .query("DELETE FROM Productos WHERE id = ?", { replacements: [id] })
    .then(function (resultado) {
      res.status(200);
      res.send("Producto eliminado");
    });
});

//USUARIOS

app.post("/join", usuarioRepetido, (req, res) => {
  const usuario = req.body;
  sequelize
    .query(
      "INSERT INTO usuarios (ID, Usuario, Nombre_y_apellido, Correo_electronico, Telefono, Direccion_de_envio, Contraseña) VALUES (NULL, ?, ?, ?, ?, ?, ?)",
      {
        replacements: [
          usuario.usuario,
          usuario.nombreApellido,
          usuario.correoElectronico,
          usuario.telefono,
          usuario.direccionEnvio,
          usuario.contraseña,
        ],
      }
    )
    .then(function (resultado) {
      res.status(200);
      res.send("Usuario creado exitosamente");
    });
});

app.post("/login", validarUsuarioContraseña, (req, res) => {
  const usuario = req.body;
  const token = jwt.sign(usuario.nombreUsuario, "1234");
  res.json({ token });
  console.log(usuario.nombreUsuario);
});

//PEDIDOS

app.post(
  "/pedidos",
  usuarioLogueado,
  verificarProductos,
  verificarDatos,
  (req, res) => {
    const pedido = req.body;
    const arrayProductosToString = pedido.Producto.toString();
    console.log(arrayProductosToString);
    sequelize
      .query(
        "INSERT INTO pedidos (ID, Detalle, Forma_de_pago, Direccion) VALUES (NULL, ?, ?, ?)",
        {
          replacements: [
            arrayProductosToString,
            pedido.Forma_de_pago,
            pedido.Direccion,
          ],
        }
      )
      .then(function (resultado) {
        console.log("ok");
      });

    /*sequelize
    .query(
      "SELECT Precio FROM productos WHERE Nombre = ?",
      { replacements: [pedido.Producto[0]] },
      { type: sequelize.QueryTypes.SELECT }
    )
    .then(function (resultado) {
      console.log(resultado[0][0].Precio);
      sequelize
        .query("UPDATE pedidos SET Total = ? WHERE Detalle = ?", {
          replacements: [resultado[0][0].Precio, pedido.Producto],
        })
        .then(function (resultado) {
          console.log("funciono");
        });
    });*/
  }
);
