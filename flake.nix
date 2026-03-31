{
  description = "Phone Coverage Scheduler";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in {
        devShells.default = pkgs.mkShell {
          packages = [ pkgs.nodejs_22 ];
        };

        packages.default = pkgs.buildNpmPackage {
          pname = "schedule-builder";
          version = "0.1.0";
          src = ./.;

          # Run: nix build 2>&1 | grep "got:" to get the correct hash
          npmDepsHash = pkgs.lib.fakeHash;

          installPhase = ''
            cp -r dist $out
          '';
        };
      });
}
