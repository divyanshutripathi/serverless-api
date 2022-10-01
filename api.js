const db = require("./db");
const {
  draftStatus,
  completeStatus,
  assignedStatus,
  inprogressStatus,
  closeStatus,
  regexForTitle,
  managerRole,
  memberRole,
  leadRole,
} = require("./config/const");
const { v4: uuidv4 } = require("uuid");
const {
  GetItemCommand,
  PutItemCommand,
  DeleteItemCommand,
  ScanCommand,
  UpdateItemCommand,
} = require("@aws-sdk/client-dynamodb");
const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb");

const checkUser = async (userId) => {
  const response = { statusCode: 200 };

  try {
    const params = {
      TableName: process.env.DYNAMODB_USER_TABLE_NAME,
      Key: marshall({ userId: userId }),
    };
    const { Item } = await db.send(new GetItemCommand(params));

    console.log({ Item });
    return {
      message: "Successfully retrieved User.",
      data: Item ? unmarshall(Item) : {},
      rawData: Item,
    };
  } catch (e) {
    console.error(e);
    //   response.statusCode = 500;
    console.log({
      message: "Failed to get Task.",
      errorMsg: e.message,
      errorStack: e.stack,
    });
  }

  // return response;
};

const getTask = async (event) => {
  const response = { statusCode: 200 };

  try {
    const params = {
      TableName: process.env.DYNAMODB_TABLE_NAME,
      Key: marshall({ taskId: event.pathParameters.taskId }),
    };
    const { Item } = await db.send(new GetItemCommand(params));

    console.log({ Item });
    response.body = JSON.stringify({
      message: "Successfully retrieved Task.",
      data: Item ? unmarshall(Item) : {},
      rawData: Item,
    });
  } catch (e) {
    console.error(e);
    response.statusCode = 500;
    response.body = JSON.stringify({
      message: "Failed to get Task.",
      errorMsg: e.message,
      errorStack: e.stack,
    });
  }

  return response;
};

const createTask = async (event) => {
  const response = { statusCode: 200 };

  try {
    const taskId = uuidv4();
    const body = JSON.parse(event.body);
    const user = await checkUser(body.userId);
    console.log("user : ", user);
    if (
      user &&
      (user.data.userRole.toLowerCase() === leadRole.toLowerCase() ||
        user.data.userRole.toLowerCase() === managerRole.toLowerCase())
    ) {
      if (body.title.test(regexForTitle) && body.title > 3 && body.title < 30) {
        const query = {
          taskId,
          title: body.title,
          description: body.description | null,
          dateCreated: Date.now(),
          dateStarted: null,
          dateAssigned: null,
          dateCompleted: null,
          dateClosed: null,
          status: draftStatus,
          createdBy: body.userId,
          assignedTo: null,
        };

        const params = {
          TableName: process.env.DYNAMODB_TABLE_NAME,
          Item: marshall(query || {}),
        };
        const createResult = await db.send(new PutItemCommand(params));

        response.body = JSON.stringify({
          message: "Successfully created Task.",
          createResult,
        });
      } else {
        response.body = JSON.stringify({
          message:
            "Title should have only # and _ as special character, should be >3 and <30 characters.",
        });
      }
    } else {
      if (user) {
        response.body = JSON.stringify({
          message: "User does not have the Authority",
        });
      } else {
        response.body = JSON.stringify({
          message: "User not found",
        });
      }
    }
  } catch (e) {
    console.error(e);
    response.statusCode = 500;
    response.body = JSON.stringify({
      message: "Failed to create Task.",
      errorMsg: e.message,
      errorStack: e.stack,
    });
  }

  return response;
};

const createUser = async (event) => {
  const response = { statusCode: 200 };

  try {
    const userId = uuidv4();
    const body = JSON.parse(event.body);
    let userRole = body.userRole;
    //   const user = checkUser(body.email);
    //   if (
    //     user &&
    //     (user.data.userRole.toLowerCase() === leadRole.toLowerCase() ||
    //       user.data.userRole.toLowerCase() === managerRole.toLowerCase())
    //   ) {
    // if (body.title.test(regexForTitle) && body.title > 3 && body.title < 30) {
    const query = {
      userId,
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      dateCreated: Date.now(),
      userRole,
    };

    const params = {
      TableName: process.env.DYNAMODB_USER_TABLE_NAME,
      Item: marshall(query || {}),
    };
    const createResult = await db.send(new PutItemCommand(params));

    response.body = JSON.stringify({
      message: "Successfully created User.",
      createResult,
    });
    //     } else {
    //       response.body = JSON.stringify({
    //         message:
    //           "Title should have only # and _ as special character, should be >3 and <30 characters.",
    //       });
    //     }
    //   } else {
    //     if (user) {
    //       response.body = JSON.stringify({
    //         message: "User does not have the Authority",
    //       });
    //     } else {
    //       response.body = JSON.stringify({
    //         message: "User not found",
    //       });
    //     }
    //   }
  } catch (e) {
    console.error(e);
    response.statusCode = 500;
    response.body = JSON.stringify({
      message: "Failed to create User.",
      errorMsg: e.message,
      errorStack: e.stack,
    });
  }

  return response;
};

const updateTaskCommon = async (body) => {
  const res = { statusCode: 200 };
  try {
    if (
      (body.title &&
        body.title.test(regexForTitle) &&
        body.title > 3 &&
        body.title < 30) ||
      !body.title
    ) {
      const objKeys = Object.keys(body);
      const params = {
        TableName: process.env.DYNAMODB_TABLE_NAME,
        Key: marshall({ taskId: body.taskId }),
        UpdateExpression: `SET ${objKeys
          .map((_, index) => `#key${index} = :value${index}`)
          .join(", ")}`,
        ExpressionAttributeNames: objKeys.reduce(
          (acc, key, index) => ({
            ...acc,
            [`#key${index}`]: key,
          }),
          {}
        ),
        ExpressionAttributeValues: marshall(
          objKeys.reduce(
            (acc, key, index) => ({
              ...acc,
              [`:value${index}`]: body[key],
            }),
            {}
          )
        ),
      };
      const updateResult = await db.send(new UpdateItemCommand(params));

      res.body = JSON.stringify({
        message: "Successfully updated Task.",
        updateResult,
      });
    } else {
      response.body = JSON.stringify({
        message:
          "Title should have only # and _ as special character, should be >3 and <30 characters.",
      });
    }
  } catch (e) {
    console.error(e);
    res.statusCode = 500;
    res.body = JSON.stringify({
      message: "Failed to update Task.",
      errorMsg: e.message,
      errorStack: e.stack,
    });
  }

  return res;
};

const updateTask = async (event) => {
  let response = { statusCode: 200 };

  try {
    const user = await checkUser(body.userId);
    if (user) {
      const body = JSON.parse(event.body);
      if (body.title || body.description) {
        body.taskId = event.pathParameters.taskId;
        response = { ...updateTaskCommon(body) };
      } else {
        response.body = JSON.stringify({
          message: "wrong query",
        });
      }
    } else {
      response.body = JSON.stringify({
        message: "User not found",
      });
    }
  } catch (e) {
    console.error(e);
    response.statusCode = 500;
    response.body = JSON.stringify({
      message: "Failed to update Task.",
      errorMsg: e.message,
      errorStack: e.stack,
    });
  }

  return response;
};

const deleteTask = async (event) => {
  const response = { statusCode: 200 };

  try {
    const user = await checkUser(body.userId);
    if (
      user &&
      (user.data.userRole.toLowerCase() === leadRole.toLowerCase() ||
        user.data.userRole.toLowerCase() === managerRole.toLowerCase())
    ) {
      const params = {
        TableName: process.env.DYNAMODB_TABLE_NAME,
        Key: marshall({ taskId: event.pathParameters.taskId }),
      };
      const deleteResult = await db.send(new DeleteItemCommand(params));

      response.body = JSON.stringify({
        message: "Successfully deleted Task.",
        deleteResult,
      });
    } else {
      if (user) {
        response.body = JSON.stringify({
          message: "User does not have the Authority",
        });
      } else {
        response.body = JSON.stringify({
          message: "User not found",
        });
      }
    }
  } catch (e) {
    console.error(e);
    response.statusCode = 500;
    response.body = JSON.stringify({
      message: "Failed to delete Task.",
      errorMsg: e.message,
      errorStack: e.stack,
    });
  }

  return response;
};

const getAllTasksForAUser = async (event) => {
  const response = { statusCode: 200 };

  try {
    const user = await checkUser(event.pathParameters.userId);
    if (user) {
      const params = {
        TableName: process.env.DYNAMODB_TABLE_NAME,
        Key: marshall({ userId: event.pathParameters.userId }),
      };
      const { Items } = await db.send(new GetItemCommand(params));

      console.log({ Items });
      response.body = JSON.stringify({
        message: "Successfully retrieved Task.",
        data: Items ? unmarshall(Items) : {},
        rawData: Items,
      });
    } else {
      response.body = JSON.stringify({
        message: "User not found",
      });
    }
  } catch (e) {
    console.error(e);
    response.statusCode = 500;
    response.body = JSON.stringify({
      message: "Failed to retrieve Tasks.",
      errorMsg: e.message,
      errorStack: e.stack,
    });
  }

  return response;
};
//TO DO
const assignTaskToAUser = async (event) => {
  const response = { statusCode: 200 };

  try {
    const body = JSON.parse(event.body);
    const user1 = await checkUser(body.userId);
    const user2 = await checkUser(event.pathParameters.memberId);
    if (
      user1 &&
      (user1.data.userRole.toLowerCase() === leadRole.toLowerCase() ||
        user1.data.userRole.toLowerCase() === managerRole.toLowerCase())
    ) {
      if (user2) {
        body.taskId = event.pathParameters.taskId;
        body.dateAssigned = Date.now();
        body.status = assignedStatus;
        body.assignedTo = event.pathParameters.memberId;
        response = { ...(await updateTaskCommon(body)) };
      } else {
        response.body = JSON.stringify({
          message: "member does not exist",
        });
      }
    } else {
      response.body = JSON.stringify({
        message: "User not found.",
      });
    }
  } catch (e) {
    console.error(e);
    response.statusCode = 500;
    response.body = JSON.stringify({
      message: "Failed to update Task.",
      errorMsg: e.message,
      errorStack: e.stack,
    });
  }

  return response;
};
// TO DO
const updateTaskToInprogress = async (event) => {
  const response = { statusCode: 200 };

  try {
    const body = JSON.parse(event.body);
    const user = await checkUser(body.userId);
    if (user) {
      body.taskId = event.pathParameters.taskId;
      body.dateStarted = Date.now();
      body.status = inprogressStatus;
      response = { ...(await updateTaskCommon(body)) };
    } else {
      response.body = JSON.stringify({
        message: "User not found.",
      });
    }
  } catch (e) {
    console.error(e);
    response.statusCode = 500;
    response.body = JSON.stringify({
      message: "Failed to update Task.",
      errorMsg: e.message,
      errorStack: e.stack,
    });
  }

  return response;
};

const updateTaskToComplete = async (event) => {
  const response = { statusCode: 200 };

  try {
    const body = JSON.parse(event.body);
    const user = await checkUser(body.userId);
    if (user) {
      body.taskId = event.pathParameters.taskId;
      body.dateCompleted = Date.now();
      body.status = completeStatus;
      response = { ...(await updateTaskCommon(body)) };
    } else {
      response.body = JSON.stringify({
        message: "User not found.",
      });
    }
  } catch (e) {
    console.error(e);
    response.statusCode = 500;
    response.body = JSON.stringify({
      message: "Failed to update Task.",
      errorMsg: e.message,
      errorStack: e.stack,
    });
  }

  return response;
};

const updateTaskToClose = async (event) => {
  const response = { statusCode: 200 };

  try {
    const body = JSON.parse(event.body);
    const user = await checkUser(body.userId);
    if (
      user &&
      (user.data.userRole.toLowerCase() === leadRole.toLowerCase() ||
        user.data.userRole.toLowerCase() === managerRole.toLowerCase())
    ) {
      body.taskId = event.pathParameters.taskId;
      body.status = closeStatus;
      body.dateClosed = Date.now();
      response = { ...(await updateTaskCommon(body)) };
    } else {
      if (user) {
        response.body = JSON.stringify({
          message: "User does not have the Authority",
        });
      } else {
        response.body = JSON.stringify({
          message: "User not found",
        });
      }
    }
  } catch (e) {
    console.error(e);
    response.statusCode = 500;
    response.body = JSON.stringify({
      message: "Failed to update Task.",
      errorMsg: e.message,
      errorStack: e.stack,
    });
  }

  return response;
};
module.exports = {
  getTask,
  createTask,
  updateTask,
  deleteTask,
  getAllTasksForAUser,
  assignTaskToAUser,
  updateTaskToInprogress,
  updateTaskToComplete,
  updateTaskToClose,
  createUser,
};
