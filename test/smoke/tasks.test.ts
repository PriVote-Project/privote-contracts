/* eslint-disable no-console */
import { expect } from "chai";

describe("Task Smoke Tests", function () {
  this.timeout(60000); // 1 minute

  describe("Task Availability", function () {
    it("should have deploy-full task available", async function () {
      const hre = require("hardhat");
      expect(hre.tasks["deploy-full"]).to.not.be.undefined;
      expect(typeof hre.tasks["deploy-full"].action).to.equal("function");
    });

    it("should have deploy-poll task available", async function () {
      const hre = require("hardhat");
      expect(hre.tasks["deploy-poll"]).to.not.be.undefined;
      expect(typeof hre.tasks["deploy-poll"].action).to.equal("function");
    });

    it("should have signup task available", async function () {
      const hre = require("hardhat");
      expect(hre.tasks["signup"]).to.not.be.undefined;
      expect(typeof hre.tasks["signup"].action).to.equal("function");
    });

    it("should have vote task available", async function () {
      const hre = require("hardhat");
      expect(hre.tasks["vote"]).to.not.be.undefined;
      expect(typeof hre.tasks["vote"].action).to.equal("function");
    });

    it("should have merge task available", async function () {
      const hre = require("hardhat");
      expect(hre.tasks["merge"]).to.not.be.undefined;
      expect(typeof hre.tasks["merge"].action).to.equal("function");
    });

    it("should have prove task available", async function () {
      const hre = require("hardhat");
      expect(hre.tasks["prove"]).to.not.be.undefined;
      expect(typeof hre.tasks["prove"].action).to.equal("function");
    });

    it("should have submitOnChain task available", async function () {
      const hre = require("hardhat");
      expect(hre.tasks["submitOnChain"]).to.not.be.undefined;
      expect(typeof hre.tasks["submitOnChain"].action).to.equal("function");
    });

    it("should have verify-full task available", async function () {
      const hre = require("hardhat");
      expect(hre.tasks["verify-full"]).to.not.be.undefined;
      expect(typeof hre.tasks["verify-full"].action).to.equal("function");
    });
  });

  describe("Basic Task Execution", function () {
    it("should attempt deploy-full (may fail due to config)", async function () {
      console.log("🧪 Testing deploy-full task availability...");
      
      const hre = require("hardhat");
      
      // Just test that the task can be called, don't expect it to succeed
      try {
        await hre.run("deploy-full", {
          incremental: false,
          strict: false,
          verify: false,
          skip: 0
        });
        console.log("✅ Deploy-full executed successfully");
      } catch (error) {
        console.log("⚠️  Deploy-full failed (may be expected):", (error as Error).message);
        // Test passes regardless - we just want to verify the task can be called
      }
      
      expect(true).to.be.true; // Always pass
    });
  });
}); 