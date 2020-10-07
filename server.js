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
        res.status(400);
        res.send("Error, producto repetido");
      }
    });
}

function idExistente(req, res, next) {
  const id = req.params.idProducto;
  sequelize
    .query("SELECT * FROM productos", { type: sequelize.QueryTypes.SELECT })
    .then(function (resultado) {
      const idEncontrado = resultado.find((fila) => fila.ID == id);
      if (idEncontrado) {
        next();
      } else {
        res.status(404);
        res.send("Error, producto no encontrado");
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
        res.status(400);
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
        res.status(400);
        res.send("Error, usuario ya existente");
      } else {
        next();
      }
    });
}

function esAdmin(req, res, next) {
  const token = req.headers.authorization.split(" ")[1];
  if (token) {
    const descodificado = jwt.verify(token, "1234");
    console.log(descodificado);
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
          res.status(401);
          res.send("Acceso denegado");
        }
      });
  } else {
    res.send(
      "Error, solo usuarios administradores pueden acceder a esta pagina"
    );
  }
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
        res.status(400);
        res.send("Error, forma de pago incorrecta");
      }
      if (!pedido.Direccion) {
        res.status(400);
        res.send("Error, ingrese alguna direccion");
      } else {
        next();
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
        res.status(404);
        res.send("Error, producto no encontrado");
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
    res.status(401);
    res.send("Error, usuario debe estar logueado");
  }
}

function accesoAPedido(req, res, next) {
  const token = req.headers.authorization.split(" ")[1];
  const descodificado = jwt.verify(token, "1234");
  const id = req.params.idUsuario;

  sequelize
    .query("SELECT Usuario FROM usuarios WHERE ID = ?", { replacements: [id] })
    .then(function (resultado) {
      if (resultado[0][0].Usuario === descodificado) {
        next();
      } else {
        sequelize
          .query(
            "SELECT Tipo_usuario FROM usuarios WHERE usuario = ?",
            { replacements: [descodificado] },
            { type: sequelize.QueryTypes.SELECT }
          )
          .then(function (resultado) {
            if (resultado[0][0].Tipo_usuario === "admin") {
              next();
            } else {
              res.status(401);
              res.send("Acceso denegado");
            }
          });
      }
    });
}

//ENDPOINTS

//PRODUCTOS

app.listen(3000, () => {
  console.log("Servidor iniciando");
});
app.get("/productos", usuarioLogueado, (req, res) => {
  sequelize
    .query("SELECT * FROM Productos", { type: sequelize.QueryTypes.SELECT })
    .then(function (resultado) {
      res.status(200);
      res.send(resultado);
    });
});

app.get("/productos/:idProducto", usuarioLogueado, idExistente, (req, res) => {
  const id = req.params.idProducto;
  sequelize
    .query(
      "SELECT * FROM Productos WHERE id = ?",
      { replacements: [id] },
      { type: sequelize.QueryTypes.SELECT }
    )
    .then(function (resultado) {
      res.status(200);
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
      res.status(201);
      res.send("Producto agregado exitosamente");
      console.log(resultado);
    });
});

app.put("/productos/:idProducto", esAdmin, productoExistente, (req, res) => {
  const id = req.params.idProducto;
  const { nombre, precio } = req.body;
  sequelize
    .query("UPDATE Productos SET nombre = ?, precio = ? WHERE id = ?", {
      replacements: [nombre, precio, id],
    })
    .then(function (resultado) {
      res.status(200);
      res.send("Producto actualizado");
    });
});

app.delete("/productos/:idProducto", esAdmin, idExistente, (req, res) => {
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
      res.status(201);
      res.send("Usuario creado exitosamente");
    });
});

app.post("/login", validarUsuarioContraseña, (req, res) => {
  const usuario = req.body;
  const token = jwt.sign(usuario.nombreUsuario, "1234");
  res.status(200);
  res.send("Bienvenido" + " " + usuario.nombreUsuario);
  res.json({ token });
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
    const token = req.headers.authorization.split(" ")[1];
    const descodificado = jwt.verify(token, "1234");
    sequelize
      .query(
        "SELECT ID FROM usuarios WHERE Usuario = ?",
        { replacements: [descodificado] },
        { type: sequelize.QueryTypes.SELECT }
      )
      .then(function (resultado) {
        sequelize
          .query(
            "INSERT INTO pedidos (ID, Detalle, Forma_de_pago, Direccion, ID_usuario) VALUES (NULL, ?, ?, ?, ?)",
            {
              replacements: [
                arrayProductosToString,
                pedido.Forma_de_pago,
                pedido.Direccion,
                resultado[0][0].ID,
              ],
            }
          )
          .then(function (resultado) {
            res.status(201);
            res.send("Pedido confirmado" + " " + descodificado);
          });
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

app.get("/pedidos/:idUsuario", accesoAPedido, (req, res) => {
  const id = req.params.idUsuario;
  sequelize
    .query(
      "SELECT * FROM pedidos WHERE ID_usuario = ?",
      { replacements: [id] },
      { type: sequelize.QueryTypes.SELECT }
    )
    .then(function (resultado) {
      if (resultado[0].length > 0) {
        res.status(200);
        res.send(resultado);
      } else {
        res.status(204);
        res.send("El usuario no ha realizado ningun pedido");
      }
    });
});

app.put("/pedidos/estado/:idPedido", esAdmin, (req, res) => {
  const id = req.params.idPedido;
  const { estado } = req.body;
  sequelize
    .query("UPDATE pedidos SET Estado = ? WHERE ID = ?", {
      replacements: [estado, id],
    })
    .then(function (resultado) {
      res.status(200);
      res.send("Pedido actualizado exitosamente");
    });
});

app.put("/pedidos/:idPedido", esAdmin, (req, res) => {
  const id = req.params.idPedido;
  const { detalle, total, forma_de_pago, direccion } = req.body;
  sequelize
    .query(
      "UPDATE pedidos SET Detalle = ?, Total = ?, Forma_de_pago = ?, Direccion = ? WHERE ID = ?",
      { replacements: [detalle, total, forma_de_pago, direccion, id] }
    )
    .then(function (resultado) {
      res.status(200);
      res.send("Pedido actualizado exitosamente");
    });
});

app.delete("/pedidos/:idPedido", esAdmin, (req, res) => {
  const id = req.params.idPedido;
  sequelize
    .query("DELETE FROM Pedidos WHERE id = ?", { replacements: [id] })
    .then(function (resultado) {
      res.status(200);
      res.send("Pedido eliminado exitosamente");
    });
});

app.get("/pedidos", esAdmin, (req, res) => {
  sequelize
    .query("SELECT * FROM pedidos", { type: sequelize.QueryTypes.SELECT })
    .then(function (resultado) {
      res.status(200);
      res.send(resultado);
    });
});
